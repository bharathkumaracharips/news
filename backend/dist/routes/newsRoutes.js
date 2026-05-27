"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsController_1 = require("../controllers/newsController");
const router = (0, express_1.Router)();
// Endpoint for fetching news articles
router.get('/articles', newsController_1.getArticles);
// Endpoint for fetching similar articles from other publishers (Perspective Stacking)
router.get('/articles/:id/similar', newsController_1.getSimilarArticles);
// Endpoint for building chronological vertical timeline of developments
router.get('/articles/:id/timeline', newsController_1.getArticleTimeline);
exports.default = router;
