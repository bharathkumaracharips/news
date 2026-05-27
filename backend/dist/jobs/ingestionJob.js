"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestSingleSource = ingestSingleSource;
exports.runIngestionNow = runIngestionNow;
exports.crawlCategorySourcesOnDemand = crawlCategorySourcesOnDemand;
exports.initIngestionScheduler = initIngestionScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
const rssFetcher_1 = require("../services/rssFetcher");
const htmlCrawler_1 = require("../services/htmlCrawler");
let isRunning = false;
/**
 * Ingests and processes a single NewsSource.
 * Downloads feeds, crawls HTML, and updates PostgreSQL database.
 */
async function ingestSingleSource(source) {
    let newArticlesCount = 0;
    try {
        const articles = await (0, rssFetcher_1.fetchAndNormalizeFeed)(source.rssUrl, source.name);
        for (const art of articles) {
            // Check for duplication (URL or externalId check)
            const existing = await db_1.default.article.findFirst({
                where: {
                    OR: [
                        { url: art.url },
                        { externalId: art.externalId }
                    ]
                }
            });
            if (existing) {
                continue;
            }
            // Ensure Category exists
            let category = await db_1.default.category.findFirst({
                where: { name: { equals: source.categoryName, mode: 'insensitive' } }
            });
            if (!category) {
                category = await db_1.default.category.create({
                    data: { name: source.categoryName }
                });
            }
            // Crawl HTML for full-text segments
            console.log(`🕷️ [ingestionJob]: Crawling raw HTML text for: ${art.title}`);
            const crawledBody = await (0, htmlCrawler_1.crawlArticleContent)(art.url);
            const finalContent = crawledBody || art.content || 'Tap visiting source button below to read full documentation and insights.';
            // Save in PostgreSQL
            await db_1.default.article.create({
                data: {
                    title: art.title,
                    summary: art.summary,
                    content: finalContent,
                    url: art.url,
                    source: art.source,
                    externalId: art.externalId,
                    categoryId: category.id,
                    sourceId: source.id,
                    publishedAt: art.publishedAt,
                }
            });
            newArticlesCount++;
        }
        // Update last fetched timestamp
        await db_1.default.newsSource.update({
            where: { id: source.id },
            data: { lastFetchedAt: new Date() }
        });
    }
    catch (error) {
        console.error(`❌ [ingestionJob]: Error processing source "${source.name}":`, error.message);
    }
    return newArticlesCount;
}
/**
 * Triggers the live RSS ingestion pipeline.
 * Fetches data from all active sources.
 */
async function runIngestionNow() {
    if (isRunning) {
        console.log('⏳ [ingestionJob]: Ingestion pipeline is already running. Skipping.');
        return;
    }
    isRunning = true;
    console.log('🚀 [ingestionJob]: Starting live RSS ingestion pipeline...');
    try {
        const activeSources = await db_1.default.newsSource.findMany({
            where: { isActive: true },
        });
        console.log(`📋 [ingestionJob]: Loaded ${activeSources.length} active news sources from DB.`);
        for (const source of activeSources) {
            const newCount = await ingestSingleSource(source);
            console.log(`📝 [ingestionJob]: Created ${newCount} new articles for ${source.name}`);
        }
        console.log('✅ [ingestionJob]: Ingestion pipeline finished execution.');
    }
    catch (error) {
        console.error('❌ [ingestionJob]: Critical pipeline failure:', error.message);
    }
    finally {
        isRunning = false;
    }
}
/**
 * Prioritizes crawling feeds for a specific category on-demand in the background.
 * Activates when a frontend client requests category-specific articles.
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
        console.log(`⚡️ [ingestionJob]: Priority sync started for ${targetedSources.length} sources...`);
        // Ingest targeted sources on-demand
        for (const source of targetedSources) {
            const newCount = await ingestSingleSource(source);
            console.log(`⚡️ [ingestionJob]: [Priority ${categoryName}] Created ${newCount} new articles for ${source.name}`);
        }
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
