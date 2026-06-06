"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestSingleSource = ingestSingleSource;
exports.runIngestionNow = runIngestionNow;
exports.crawlCategorySourcesOnDemand = crawlCategorySourcesOnDemand;
exports.initIngestionScheduler = initIngestionScheduler;
exports.crawlAlternativePublishersForArticle = crawlAlternativePublishersForArticle;
exports.selfHealDatabaseArticles = selfHealDatabaseArticles;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
const rssFetcher_1 = require("../services/rssFetcher");
const htmlCrawler_1 = require("../services/htmlCrawler");
const newsController_1 = require("../controllers/newsController");
const embeddingService_1 = require("../services/embeddingService");
let isRunning = false;
/**
 * Ingests and processes a single NewsSource with parallelized article crawling. Capped at 5 crawls.
 */
async function ingestSingleSource(source) {
    try {
        const articles = await (0, rssFetcher_1.fetchAndNormalizeFeed)(source.rssUrl, source.name);
        if (articles.length === 0)
            return 0;
        // 1. Filter out already existing articles in parallel
        const newArticles = [];
        for (const art of articles) {
            const existing = await db_1.default.article.findFirst({
                where: {
                    OR: [
                        { url: art.url },
                        { externalId: art.externalId }
                    ]
                }
            });
            if (!existing) {
                newArticles.push(art);
            }
        }
        if (newArticles.length === 0)
            return 0;
        // 2. Cap crawls at the latest 5 new articles to satisfy zero-overhead and rate-limit constraints
        const articlesToCrawl = newArticles.slice(0, 5);
        // Ensure Category exists or create it
        let category = await db_1.default.category.findFirst({
            where: { name: { equals: source.categoryName, mode: 'insensitive' } }
        });
        if (!category) {
            category = await db_1.default.category.create({
                data: { name: source.categoryName }
            });
        }
        const categoryId = category.id;
        console.log(`🕷️ [ingestionJob]: [${source.name}] Spawning parallel crawler workers for ${articlesToCrawl.length} new articles...`);
        // 3. Crawl all 5 target articles concurrently using Promise.all
        const crawlPromises = articlesToCrawl.map(async (art) => {
            try {
                const crawledBody = await (0, htmlCrawler_1.crawlArticleContent)(art.url);
                const finalContent = crawledBody || art.content || 'Tap visiting source button below to read full documentation.';
                return {
                    title: art.title,
                    summary: art.summary,
                    content: finalContent,
                    url: art.url,
                    source: art.source,
                    externalId: art.externalId,
                    categoryId,
                    sourceId: source.id,
                    publishedAt: art.publishedAt,
                };
            }
            catch (err) {
                console.error(`⚠️ [ingestionJob]: Worker error crawling ${art.url}:`, err.message);
                return null;
            }
        });
        const crawledArticles = await Promise.all(crawlPromises);
        // 4. Save successfully crawled articles to database and cluster via embeddings
        let savedCount = 0;
        for (const data of crawledArticles) {
            if (data) {
                const created = await db_1.default.article.create({ data });
                savedCount++;
                // Generate embedding and assign to a NewsEvent cluster (non-blocking)
                (0, embeddingService_1.assignArticleToEvent)(created.id).catch(err => {
                    console.error(`⚠️ [ingestionJob]: Clustering failed for "${data.title}":`, err.message);
                });
            }
        }
        // Update last fetched timestamp
        await db_1.default.newsSource.update({
            where: { id: source.id },
            data: { lastFetchedAt: new Date() }
        });
        return savedCount;
    }
    catch (error) {
        console.error(`❌ [ingestionJob]: Error processing source "${source.name}":`, error.message);
        return 0;
    }
}
/**
 * Triggers the live RSS ingestion pipeline.
 * Fetches data from all active sources concurrently in parallel batches!
 */
async function runIngestionNow() {
    if (isRunning) {
        console.log('⏳ [ingestionJob]: Ingestion pipeline is already running. Skipping.');
        return;
    }
    isRunning = true;
    console.log('🚀 [ingestionJob]: Starting high-concurrency live RSS ingestion pipeline...');
    const startTime = Date.now();
    try {
        const activeSources = await db_1.default.newsSource.findMany({
            where: { isActive: true },
        });
        console.log(`📋 [ingestionJob]: Loaded ${activeSources.length} active news sources. Processing concurrently...`);
        // Spawns parallel worker promises for all active sources concurrently!
        const sourcePromises = activeSources.map(async (source) => {
            const count = await ingestSingleSource(source);
            return { name: source.name, count };
        });
        const results = await Promise.all(sourcePromises);
        const totalCreated = results.reduce((acc, curr) => acc + curr.count, 0);
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [ingestionJob]: Parallel Ingestion completed! Created ${totalCreated} total articles across sources in ${durationSec}s.`);
    }
    catch (error) {
        console.error('❌ [ingestionJob]: Critical pipeline failure:', error.message);
    }
    finally {
        isRunning = false;
    }
}
/**
 * Prioritizes crawling feeds for a specific category on-demand in the background concurrently.
 */
async function crawlCategorySourcesOnDemand(categoryName) {
    console.log(`⚡️ [ingestionJob]: Priority category crawl requested for: ${categoryName}`);
    try {
        const targetedSources = await db_1.default.newsSource.findMany({
            where: {
                isActive: true,
                categoryName: { equals: categoryName, mode: 'insensitive' }
            },
        });
        if (targetedSources.length === 0) {
            console.log(`⚡️ [ingestionJob]: No targeted feeds registered for priority category: ${categoryName}`);
            return;
        }
        console.log(`⚡️ [ingestionJob]: Priority sync spawning concurrent workers for ${targetedSources.length} sources...`);
        const sourcePromises = targetedSources.map(async (source) => {
            const count = await ingestSingleSource(source);
            console.log(`⚡️ [ingestionJob]: [Priority ${categoryName}] Created ${count} new articles for ${source.name}`);
        });
        await Promise.all(sourcePromises);
        console.log(`⚡️ [ingestionJob]: Priority sync completed for: ${categoryName}`);
    }
    catch (error) {
        console.error(`❌ [ingestionJob]: On-demand priority crawl failed for ${categoryName}:`, error.message);
    }
}
/**
 * Initializes background cron schedule for news ingestion.
 * Runs every 15 minutes by default.
 */
function initIngestionScheduler() {
    console.log('⏰ [ingestionJob]: Initializing RSS ingestion scheduler (Schedule: */15 * * * *)...');
    node_cron_1.default.schedule('*/15 * * * *', async () => {
        console.log('⏰ [ingestionJob]: Scheduled cron triggered!');
        await runIngestionNow();
    });
}
function getSearchQueryFromTitle(title) {
    // Extract all capitalized words (excluding common start/stop words)
    const words = title.split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
    const entities = [];
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.length > 2 && /^[A-Z]/.test(w)) {
            const lower = w.toLowerCase();
            if (!newsController_1.STOPWORDS.has(lower)) {
                entities.push(w);
            }
        }
    }
    if (entities.length < 2) {
        const sigWords = title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !newsController_1.STOPWORDS.has(w));
        return sigWords.slice(0, 3).join(' ');
    }
    return entities.slice(0, 4).join(' ');
}
/**
 * Dynamically crawls alternative publishers for the exact same event in the background on-demand.
 */
async function crawlAlternativePublishersForArticle(title, categoryId, categoryName) {
    try {
        const query = getSearchQueryFromTitle(title);
        if (!query)
            return;
        console.log(`📡 [ingestionJob]: Dynamically searching Google News for same event perspective stack: "${query}"`);
        const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
        const discoveredArticles = await (0, rssFetcher_1.fetchAndNormalizeFeed)(searchUrl, 'Google News Dynamic Search');
        if (discoveredArticles.length === 0)
            return;
        // Filter to those that cover the EXACT same event (using areArticlesSimilar check)
        const matchedArticles = discoveredArticles.filter(art => (0, newsController_1.areArticlesSimilar)(title, art.title));
        if (matchedArticles.length === 0)
            return;
        // Filter to those not already in database
        const newArticles = [];
        for (const art of matchedArticles) {
            const existing = await db_1.default.article.findFirst({
                where: {
                    OR: [
                        { url: art.url },
                        { title: { equals: art.title, mode: 'insensitive' } }
                    ]
                }
            });
            if (!existing) {
                newArticles.push(art);
            }
        }
        if (newArticles.length === 0)
            return;
        // Cap at top 4 new perspectives to scrape on-the-fly rapidly
        const targetArticles = newArticles.slice(0, 4);
        console.log(`🕷️ [ingestionJob]: Crawling ${targetArticles.length} dynamic perspectives for event: "${title}"...`);
        const crawlPromises = targetArticles.map(async (art) => {
            try {
                const crawledBody = await (0, htmlCrawler_1.crawlArticleContent)(art.url);
                const finalContent = crawledBody || art.content || 'Tap visiting source button below to read full documentation.';
                return {
                    title: art.title,
                    summary: art.summary,
                    content: finalContent,
                    url: art.url,
                    source: art.source,
                    externalId: art.externalId,
                    categoryId,
                    publishedAt: art.publishedAt,
                };
            }
            catch (err) {
                console.error(`⚠️ [ingestionJob]: Error scraping dynamic perspective ${art.url}:`, err.message);
                return null;
            }
        });
        const crawledArticles = await Promise.all(crawlPromises);
        for (const data of crawledArticles) {
            if (data) {
                const created = await db_1.default.article.create({ data });
                console.log(`✅ [ingestionJob]: Successfully ingested dynamic perspective from [${data.source}]: "${data.title}"`);
                try {
                    await (0, embeddingService_1.assignArticleToEvent)(created.id);
                }
                catch (err) {
                    console.error(`⚠️ [ingestionJob]: Clustering failed for perspective "${data.title}":`, err.message);
                }
            }
        }
    }
    catch (error) {
        console.error(`❌ [ingestionJob]: Dynamic perspective search failed:`, error.message);
    }
}
/**
 * Automatically heals any articles in the database with missing or placeholder content by decoding their URLs and re-crawling them.
 */
async function selfHealDatabaseArticles() {
    console.log('🩺 [Self-Heal]: Initiating database self-healing check...');
    try {
        // Fetch all articles to inspect their content length in memory (extremely low footprint)
        const allArticles = await db_1.default.article.findMany({
            include: { category: true }
        });
        const targetArticles = allArticles.filter(art => !art.content ||
            art.content.length < 150 ||
            art.content.startsWith('Tap visiting source') ||
            art.content === 'No content available.');
        if (targetArticles.length === 0) {
            console.log('🩺 [Self-Heal]: All database articles are fully populated and healthy!');
            return;
        }
        console.log(`🩺 [Self-Heal]: Found ${targetArticles.length} articles with missing/placeholder content. Repairing...`);
        // Process them in parallel batches of 5 to avoid overloading
        for (let i = 0; i < targetArticles.length; i += 5) {
            const batch = targetArticles.slice(i, i + 5);
            const repairPromises = batch.map(async (art) => {
                try {
                    const directUrl = (0, rssFetcher_1.decodeGoogleNewsUrl)(art.url);
                    const crawledBody = await (0, htmlCrawler_1.crawlArticleContent)(directUrl);
                    if (crawledBody && crawledBody.length > 150) {
                        await db_1.default.article.update({
                            where: { id: art.id },
                            data: {
                                url: directUrl,
                                content: crawledBody
                            }
                        });
                        console.log(`🩺 [Self-Heal]: Successfully repaired content for [${art.source}]: "${art.title}"`);
                    }
                    else {
                        // Update URL even if crawl fails so that it has the correct direct URL
                        await db_1.default.article.update({
                            where: { id: art.id },
                            data: { url: directUrl }
                        });
                    }
                }
                catch (err) {
                    console.error(`🩺 [Self-Heal]: Error repairing article ${art.id}:`, err.message);
                }
            });
            await Promise.all(repairPromises);
        }
        console.log('🩺 [Self-Heal]: Database self-healing process completed!');
    }
    catch (error) {
        console.error('🩺 [Self-Heal]: Critical failure during self-healing:', error.message);
    }
}
