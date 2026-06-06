import { Router, Request, Response } from 'express';
import { getArticles, getSimilarArticles, getArticleTimeline, getArticleIntelligence } from '../controllers/newsController';
import { backfillEmbeddings } from '../services/embeddingService';

const router = Router();

// Endpoint for fetching news articles
router.get('/articles', getArticles);

// Endpoint for fetching similar articles from other publishers (Perspective Stacking)
router.get('/articles/:id/similar', getSimilarArticles);

// Endpoint for building chronological vertical timeline of developments
router.get('/articles/:id/timeline', getArticleTimeline);

// Endpoint for fetching local AI generated intelligence for an article
router.get('/articles/:id/intelligence', getArticleIntelligence);

// Endpoint for backfilling embeddings for existing articles
router.post('/admin/backfill-embeddings', async (req: Request, res: Response) => {
  try {
    const result = await backfillEmbeddings();
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
