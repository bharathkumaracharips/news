"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsController_1 = require("../controllers/newsController");
const embeddingService_1 = require("../services/embeddingService");
const router = (0, express_1.Router)();
// Endpoint for fetching news articles
router.get('/articles', newsController_1.getArticles);
// Endpoint for fetching similar articles from other publishers (Perspective Stacking)
router.get('/articles/:id/similar', newsController_1.getSimilarArticles);
// Endpoint for building chronological vertical timeline of developments
router.get('/articles/:id/timeline', newsController_1.getArticleTimeline);
// Endpoint for fetching local AI generated intelligence for an article
router.get('/articles/:id/intelligence', newsController_1.getArticleIntelligence);
// Endpoint for backfilling embeddings for existing articles
router.post('/admin/backfill-embeddings', async (req, res) => {
    try {
        const result = await (0, embeddingService_1.backfillEmbeddings)();
        res.status(200).json({ success: true, ...result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
