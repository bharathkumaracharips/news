import { Request, Response } from 'express';
import prisma from '../config/db';

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
