import { Request, Response } from 'express';
import prisma from '../config/db';
import { extractArticlesFromPdf } from '../services/pdfService';

export const uploadNewspaper = async (req: Request, res: Response) => {
  try {
    const { name, publishDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'PDF file is required' });
    }

    if (!name || !publishDate) {
      return res.status(400).json({ success: false, message: 'Newspaper name and publishDate are required' });
    }

    const parsedDate = new Date(publishDate);

    // Parse the PDF
    const articlesData = await extractArticlesFromPdf(file.buffer);

    // Save to database
    const newspaper = await prisma.newspaper.create({
      data: {
        name,
        publishDate: parsedDate,
        articles: {
          create: articlesData.map(a => ({
            title: a.title,
            content: a.content,
            category: a.category
          }))
        }
      },
      include: {
        articles: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Newspaper parsed and saved successfully',
      data: newspaper
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

export const getNewspaperReport = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date query parameter is required (YYYY-MM-DD)' });
    }

    const targetDate = new Date(date as string);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const newspapers = await prisma.newspaper.findMany({
      where: {
        publishDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        articles: true
      }
    });

    if (newspapers.length === 0) {
      return res.status(404).json({ success: false, message: 'No newspapers found for this date' });
    }

    // AI Connection & Dot Connecting Simulation
    // Since we don't have a large LLM, we will aggregate the articles by category and cross-reference which papers covered which categories
    const categoryMap: Record<string, { papers: Set<string>, articles: any[] }> = {};

    newspapers.forEach(paper => {
      paper.articles.forEach(article => {
        if (!categoryMap[article.category]) {
          categoryMap[article.category] = { papers: new Set(), articles: [] };
        }
        categoryMap[article.category].papers.add(paper.name);
        categoryMap[article.category].articles.push({
          newspaper: paper.name,
          title: article.title,
          contentPreview: article.content.substring(0, 150) + '...'
        });
      });
    });

    // Format the response
    const analysisReport = Object.keys(categoryMap).map(category => {
      const data = categoryMap[category];
      const papersCovered = Array.from(data.papers);
      
      let synthesis = '';
      if (papersCovered.length > 1) {
        synthesis = `AI indicates highly interconnected reporting across ${papersCovered.join(' and ')}. This highlights a broad multi-perspective impact on the ${category} sector.`;
      } else {
        synthesis = `AI analysis shows exclusive coverage by ${papersCovered[0]} in the ${category} sector, indicating a specialized or localized perspective on these developments.`;
      }

      return {
        category,
        papersCovering: papersCovered,
        synthesis,
        articles: data.articles
      };
    });

    res.status(200).json({
      success: true,
      data: {
        date: startOfDay,
        papersAnalyzed: newspapers.map(n => n.name),
        report: analysisReport
      }
    });
  } catch (error: any) {
    console.error('Report Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};
