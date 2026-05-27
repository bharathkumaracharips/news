import { Request, Response } from 'express';
import prisma from '../config/db';
import { crawlCategorySourcesOnDemand } from '../jobs/ingestionJob';

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

      // Asynchronously trigger a background targeted priority sync for this category
      // It executes without blocking the API call, so the user receives a lightning-fast response!
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

    res.status(200).json({
      success: true,
      count: fetchedArticles.length,
      data: fetchedArticles,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error',
    });
  }
};
