import { Router } from 'express';
import { getArticles, getSimilarArticles } from '../controllers/newsController';

const router = Router();

// Endpoint for fetching news articles
router.get('/articles', getArticles);

// Endpoint for fetching similar articles from other publishers (Perspective Stacking)
router.get('/articles/:id/similar', getSimilarArticles);

export default router;
