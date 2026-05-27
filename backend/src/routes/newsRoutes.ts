import { Router } from 'express';
import { getArticles } from '../controllers/newsController';

const router = Router();

// Endpoint for fetching news articles
router.get('/articles', getArticles);

export default router;
