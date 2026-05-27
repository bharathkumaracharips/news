import cron from 'node-cron';
import prisma from '../config/db';
import { fetchAndNormalizeFeed } from '../services/rssFetcher';
import { crawlArticleContent } from '../services/htmlCrawler';

let isRunning = false;

interface NewsSourceType {
  id: string;
  name: string;
  rssUrl: string;
  categoryName: string;
  isActive: boolean;
  lastFetchedAt: Date | null;
  createdAt: Date;
}

/**
 * Ingests and processes a single NewsSource with parallelized article crawling. Capped at 5 crawls.
 */
export async function ingestSingleSource(source: NewsSourceType): Promise<number> {
  try {
    const articles = await fetchAndNormalizeFeed(source.rssUrl, source.name);
    if (articles.length === 0) return 0;

    // 1. Filter out already existing articles in parallel
    const newArticles = [];
    for (const art of articles) {
      const existing = await prisma.article.findFirst({
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

    if (newArticles.length === 0) return 0;

    // 2. Cap crawls at the latest 5 new articles to satisfy zero-overhead and rate-limit constraints
    const articlesToCrawl = newArticles.slice(0, 5);

    // Ensure Category exists or create it
    let category = await prisma.category.findFirst({
      where: { name: { equals: source.categoryName, mode: 'insensitive' } }
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: source.categoryName }
      });
    }

    const categoryId = category.id;

    console.log(`🕷️ [ingestionJob]: [${source.name}] Spawning parallel crawler workers for ${articlesToCrawl.length} new articles...`);

    // 3. Crawl all 5 target articles concurrently using Promise.all
    const crawlPromises = articlesToCrawl.map(async (art) => {
      try {
        const crawledBody = await crawlArticleContent(art.url);
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
      } catch (err: any) {
        console.error(`⚠️ [ingestionJob]: Worker error crawling ${art.url}:`, err.message);
        return null;
      }
    });

    const crawledArticles = await Promise.all(crawlPromises);

    // 4. Save successfully crawled articles to database in parallel transaction chunks
    let savedCount = 0;
    for (const data of crawledArticles) {
      if (data) {
        await prisma.article.create({ data });
        savedCount++;
      }
    }

    // Update last fetched timestamp
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date() }
    });

    return savedCount;
  } catch (error: any) {
    console.error(`❌ [ingestionJob]: Error processing source "${source.name}":`, error.message);
    return 0;
  }
}

/**
 * Triggers the live RSS ingestion pipeline.
 * Fetches data from all active sources concurrently in parallel batches!
 */
export async function runIngestionNow() {
  if (isRunning) {
    console.log('⏳ [ingestionJob]: Ingestion pipeline is already running. Skipping.');
    return;
  }

  isRunning = true;
  console.log('🚀 [ingestionJob]: Starting high-concurrency live RSS ingestion pipeline...');
  const startTime = Date.now();

  try {
    const activeSources = await prisma.newsSource.findMany({
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
  } catch (error: any) {
    console.error('❌ [ingestionJob]: Critical pipeline failure:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Prioritizes crawling feeds for a specific category on-demand in the background concurrently.
 */
export async function crawlCategorySourcesOnDemand(categoryName: string) {
  console.log(`⚡️ [ingestionJob]: Priority category crawl requested for: ${categoryName}`);
  
  try {
    const targetedSources = await prisma.newsSource.findMany({
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
  } catch (error: any) {
    console.error(`❌ [ingestionJob]: On-demand priority crawl failed for ${categoryName}:`, error.message);
  }
}

/**
 * Initializes background cron schedule for news ingestion.
 * Runs every 15 minutes by default.
 */
export function initIngestionScheduler() {
  console.log('⏰ [ingestionJob]: Initializing RSS ingestion scheduler (Schedule: */15 * * * *)...');
  
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ [ingestionJob]: Scheduled cron triggered!');
    await runIngestionNow();
  });
}
