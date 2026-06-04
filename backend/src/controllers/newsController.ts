import { Request, Response } from 'express';
import prisma from '../config/db';
import { crawlCategorySourcesOnDemand, crawlAlternativePublishersForArticle } from '../jobs/ingestionJob';
import { crawlArticleContent } from '../services/htmlCrawler';
import { decodeGoogleNewsUrl } from '../services/rssFetcher';

export const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'have', 'more', 'about', 'will', 'than',
  'what', 'when', 'were', 'been', 'would', 'their', 'there', 'some', 'other', 'into',
  'over', 'also', 'only', 'amid', 'says', 'said', 'news', 'after', 'does', 'just',
  'where', 'which', 'their', 'these', 'under', 'upholds', 'first', 'second', 'third'
]);

interface GroupedArticle {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string;
  isTopStory: boolean;
  isTopDevelopment: boolean;
  publishedAt: Date;
  categoryId: string;
  category: any;
  perspectives: any[];
}

/**
 * Checks if two article titles cover the exact same news event by comparing
 * their dynamically extracted proper noun entities and requiring a 70% or higher match.
 */
export function areArticlesSimilar(titleA: string, titleB: string): boolean {
  const getEntities = (title: string) => {
    return new Set(
      title
        .split(/\s+/)
        .map(w => w.replace(/[^\w]/g, ''))
        .filter(w => w.length > 2 && /^[A-Z]/.test(w))
        .map(w => w.toLowerCase())
    );
  };

  const entitiesA = getEntities(titleA);
  const entitiesB = getEntities(titleB);

  // If both titles have proper noun entities, check their intersection percentage
  if (entitiesA.size > 0 && entitiesB.size > 0) {
    let matches = 0;
    for (const ent of entitiesA) {
      if (entitiesB.has(ent)) {
        matches++;
      }
    }
    const smallerSize = Math.min(entitiesA.size, entitiesB.size);
    const entityMatchRatio = matches / smallerSize;

    // We require a 45% or higher intersection match of proper noun entities
    return entityMatchRatio >= 0.45;
  }

  // Fallback if one or both titles have no proper noun entities
  const getSignificantWords = (title: string) => {
    return new Set(
      title
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w))
    );
  };

  const wordsA = getSignificantWords(titleA);
  const wordsB = getSignificantWords(titleB);

  if (wordsA.size === 0 || wordsB.size === 0) {
    return false;
  }

  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) {
      matches++;
    }
  }

  const smallerSize = Math.min(wordsA.size, wordsB.size);
  const keywordMatchRatio = matches / smallerSize;

  // We require a 45% or higher match of significant keywords
  return keywordMatchRatio >= 0.45;
}

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { category, isTopStory, isTopDevelopment } = req.query;

    const whereClause: any = {};

    if (category) {
      whereClause.category = {
        name: {
          contains: String(category),
          mode: 'insensitive',
        },
      };

      console.log(`⚡️ [API]: User requested "${category}". Triggering priority on-demand crawler...`);
      crawlCategorySourcesOnDemand(String(category)).catch((err) => {
        console.error(`❌ [API]: Background priority sync failed:`, err.message);
      });
    }

    if (isTopStory !== undefined) {
      whereClause.isTopStory = isTopStory === 'true';
    }

    if (isTopDevelopment !== undefined) {
      whereClause.isTopDevelopment = isTopDevelopment === 'true';
    }

    const fetchedArticles = await prisma.article.findMany({
      where: whereClause,
      include: {
        category: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    // Dynamic clustering and grouping by news event topic
    const grouped: GroupedArticle[] = [];

    for (const article of fetchedArticles) {
      // Find if this article is similar to an already selected primary news event
      const match = grouped.find(g =>
        g.categoryId === article.categoryId &&
        areArticlesSimilar(g.title, article.title)
      );

      if (match) {
        // Group under the primary card as a distinct perspective
        // Ensure we don't duplicate the exact same source publisher twice in the stack
        if (!match.perspectives.some(p => p.source === article.source)) {
          match.perspectives.push({
            id: article.id,
            title: article.title,
            summary: article.summary,
            content: article.content,
            source: article.source,
            url: article.url,
            publishedAt: article.publishedAt,
            category: article.category
          });
        }
      } else {
        // Establish as a new Primary News Card on the feed
        grouped.push({
          ...article,
          perspectives: []
        });
      }
    }

    res.status(200).json({
      success: true,
      count: grouped.length,
      data: grouped,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error',
    });
  }
};

/**
 * Searches the database for similar articles from other publishers (Perspective Stacking)
 */
export const getSimilarArticles = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const referenceArticle = await prisma.article.findUnique({
      where: { id },
      include: { category: true }
    });

    if (!referenceArticle) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Dynamically heal the reference article itself in real-time if its content is a short headline-only placeholder (e.g., < 500 chars)
    if (!referenceArticle.content || referenceArticle.content.length < 500 || referenceArticle.content.startsWith('Tap visiting source')) {
      const directUrl = decodeGoogleNewsUrl(referenceArticle.url);
      try {
        const crawledBody = await crawlArticleContent(directUrl);
        if (crawledBody && crawledBody.length > 150) {
          const updatedArticle = await prisma.article.update({
            where: { id: referenceArticle.id },
            data: {
              url: directUrl,
              content: crawledBody
            },
            include: { category: true }
          });
          // Update referenceArticle object in memory for downstream similar search matching
          referenceArticle.content = updatedArticle.content;
          referenceArticle.url = updatedArticle.url;
          console.log(`🩺 [Real-Time Heal]: Instantly healed content for [${referenceArticle.source}]: "${referenceArticle.title}"`);
        } else {
          // Update URL even if crawl fails so that it has the correct direct URL
          const updatedArticle = await prisma.article.update({
            where: { id: referenceArticle.id },
            data: { url: directUrl },
            include: { category: true }
          });
          referenceArticle.url = updatedArticle.url;
        }
      } catch (err: any) {
        console.error(`🩺 [Real-Time Heal]: Failed to heal article ${referenceArticle.id}:`, err.message);
      }
    }

    // Dynamically crawl alternative publishers for the exact same event on-demand in real-time
    await crawlAlternativePublishersForArticle(
      referenceArticle.title,
      referenceArticle.categoryId,
      referenceArticle.category.name
    );

    const rawWords = referenceArticle.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/);

    const keywords = rawWords.filter(
      word => word.length > 3 && !STOPWORDS.has(word)
    );

    if (keywords.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }


    const similarArticles = await prisma.article.findMany({
      where: {
        id: { not: id },
        categoryId: referenceArticle.categoryId,
        OR: keywords.map(kw => ({
          title: { contains: kw, mode: 'insensitive' }
        }))
      },
      take: 24, // Pull a larger pool to allow high-precision memory filtering
      include: {
        category: true
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    // Memory filter using high-precision similarity check
    const matchedArticles = similarArticles.filter(art =>
      areArticlesSimilar(referenceArticle.title, art.title)
    );

    // Remove duplicates from the same publisher
    const uniqueSimilar = matchedArticles.filter(
      (art, index, self) => self.findIndex(t => t.source === art.source) === index
    );

    res.status(200).json({
      success: true,
      count: uniqueSimilar.length,
      data: uniqueSimilar
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

interface TimelineStep {
  id: string;
  title: string;
  publishedAt: Date;
  source: string;
  url: string;
  summary: string | null;
  content: string;
  category: any;
  perspectives: any[];
}

/**
 * Builds a chronological vertical timeline of the same news event's historical developments.
 */
export const getArticleTimeline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const referenceArticle = await prisma.article.findUnique({
      where: { id },
      include: { category: true }
    });

    if (!referenceArticle) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Dynamically heal the reference article itself in real-time if its content is a short headline-only placeholder (e.g., < 500 chars)
    if (!referenceArticle.content || referenceArticle.content.length < 500 || referenceArticle.content.startsWith('Tap visiting source')) {
      const directUrl = decodeGoogleNewsUrl(referenceArticle.url);
      try {
        const crawledBody = await crawlArticleContent(directUrl);
        if (crawledBody && crawledBody.length > 150) {
          const updatedArticle = await prisma.article.update({
            where: { id: referenceArticle.id },
            data: {
              url: directUrl,
              content: crawledBody
            },
            include: { category: true }
          });
          referenceArticle.content = updatedArticle.content;
          referenceArticle.url = updatedArticle.url;
        }
      } catch (err: any) {
        console.error(`🩺 [Timeline Heal]: Failed to heal article ${referenceArticle.id}:`, err.message);
      }
    }

    // Trigger dynamic Google News perspective/history search to populate the DB in real-time
    await crawlAlternativePublishersForArticle(
      referenceArticle.title,
      referenceArticle.categoryId,
      referenceArticle.category.name
    );

    const rawWords = referenceArticle.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/);

    const keywords = rawWords.filter(
      word => word.length > 3 && !STOPWORDS.has(word)
    );

    if (keywords.length === 0) {
      return res.status(200).json({
        success: true,
        count: 1,
        data: [{
          id: referenceArticle.id,
          title: referenceArticle.title,
          publishedAt: referenceArticle.publishedAt,
          source: referenceArticle.source,
          url: referenceArticle.url,
          summary: referenceArticle.summary,
          content: referenceArticle.content,
          category: referenceArticle.category,
          perspectives: []
        }]
      });
    }

    // Fetch all potentially related articles in same category from DB across all dates
    const relatedArticles = await prisma.article.findMany({
      where: {
        categoryId: referenceArticle.categoryId,
        OR: keywords.map(kw => ({
          title: { contains: kw, mode: 'insensitive' }
        }))
      },
      include: {
        category: true
      },
      orderBy: {
        publishedAt: 'asc' // Oldest to newest
      }
    });

    // Memory filter using high-precision dynamic entity matching
    const matchedArticles = relatedArticles.filter(art =>
      areArticlesSimilar(referenceArticle.title, art.title) || art.id === referenceArticle.id
    );

    // Group matching articles chronologically into timeline steps
    const timeline: TimelineStep[] = [];

    for (const article of matchedArticles) {
      // Find if there is an existing timeline step covering the same stage (same day/similar titles)
      const existingStep = timeline.find(step =>
        areArticlesSimilar(step.title, article.title) &&
        Math.abs(new Date(step.publishedAt).getTime() - new Date(article.publishedAt).getTime()) <= 12 * 60 * 60 * 1000 // 12-hour window
      );

      if (existingStep) {
        // Group under this timeline step as an alternate perspective coverage
        if (!existingStep.perspectives.some(p => p.source === article.source || p.id === article.id)) {
          // If the matching article is actually the reference article or has newer content,
          // make sure we don't accidentally hide it if it's the main timeline step node.
          // Otherwise, push it to perspectives.
          if (article.id !== referenceArticle.id) {
            existingStep.perspectives.push({
              id: article.id,
              title: article.title,
              summary: article.summary,
              content: article.content,
              source: article.source,
              url: article.url,
              publishedAt: article.publishedAt,
              category: article.category
            });
          } else {
            // Swap so the reference article itself is the main step node
            const oldMain = { ...existingStep, perspectives: [] };
            existingStep.id = article.id;
            existingStep.title = article.title;
            existingStep.summary = article.summary;
            existingStep.content = article.content;
            existingStep.source = article.source;
            existingStep.url = article.url;
            existingStep.publishedAt = article.publishedAt;
            existingStep.category = article.category;
            
            if (oldMain.source !== article.source) {
              existingStep.perspectives.push(oldMain);
            }
          }
        }
      } else {
        // Establish as a distinct historical stage in the chronological timeline
        timeline.push({
          id: article.id,
          title: article.title,
          publishedAt: article.publishedAt,
          source: article.source,
          url: article.url,
          summary: article.summary,
          content: article.content,
          category: article.category,
          perspectives: []
        });
      }
    }

    res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};
