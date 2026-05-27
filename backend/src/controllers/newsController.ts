import { Request, Response } from 'express';
import prisma from '../config/db';
import { crawlCategorySourcesOnDemand, crawlAlternativePublishersForArticle } from '../jobs/ingestionJob';

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
    
    // We require a 70% or higher intersection match of proper noun entities
    return entityMatchRatio >= 0.70;
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

  // We require a 70% or higher match of significant keywords
  return keywordMatchRatio >= 0.70;
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
