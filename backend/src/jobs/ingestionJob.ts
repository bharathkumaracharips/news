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
 * Ingests and processes a single NewsSource.
 * Downloads feeds, crawls HTML, and updates PostgreSQL database.
 */
export async function ingestSingleSource(source: NewsSourceType): Promise<number> {
  let newArticlesCount = 0;
  
  try {
    const articles = await fetchAndNormalizeFeed(source.rssUrl, source.name);

    for (const art of articles) {
      // Check for duplication (URL or externalId check)
      const existing = await prisma.article.findFirst({
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
      let category = await prisma.category.findFirst({
        where: { name: { equals: source.categoryName, mode: 'insensitive' } }
      });

      if (!category) {
        category = await prisma.category.create({
          data: { name: source.categoryName }
        });
      }

      // Crawl HTML for full-text segments
      console.log(`🕷️ [ingestionJob]: Crawling raw HTML text for: ${art.title}`);
      const crawledBody = await crawlArticleContent(art.url);
      const finalContent = crawledBody || art.content || 'Tap visiting source button below to read full documentation and insights.';

      // Save in PostgreSQL
      await prisma.article.create({
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
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date() }
    });

  } catch (error: any) {
    console.error(`❌ [ingestionJob]: Error processing source "${source.name}":`, error.message);
  }

  return newArticlesCount;
}

/**
 * Triggers the live RSS ingestion pipeline.
 * Fetches data from all active sources.
 */
export async function runIngestionNow() {
  if (isRunning) {
    console.log('⏳ [ingestionJob]: Ingestion pipeline is already running. Skipping.');
    return;
  }

  isRunning = true;
  console.log('🚀 [ingestionJob]: Starting live RSS ingestion pipeline...');

  try {
    const activeSources = await prisma.newsSource.findMany({
      where: { isActive: true },
    });

    console.log(`📋 [ingestionJob]: Loaded ${activeSources.length} active news sources from DB.`);

    for (const source of activeSources) {
      const newCount = await ingestSingleSource(source);
      console.log(`📝 [ingestionJob]: Created ${newCount} new articles for ${source.name}`);
    }

    console.log('✅ [ingestionJob]: Ingestion pipeline finished execution.');
  } catch (error: any) {
    console.error('❌ [ingestionJob]: Critical pipeline failure:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Prioritizes crawling feeds for a specific category on-demand in the background.
 * Activates when a frontend client requests category-specific articles.
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

    console.log(`⚡️ [ingestionJob]: Priority sync started for ${targetedSources.length} sources...`);

    // Ingest targeted sources on-demand
    for (const source of targetedSources) {
      const newCount = await ingestSingleSource(source);
      console.log(`⚡️ [ingestionJob]: [Priority ${categoryName}] Created ${newCount} new articles for ${source.name}`);
    }

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
