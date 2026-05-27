"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const newsController_1 = require("../controllers/newsController");
const router = (0, express_1.Router)();
// Endpoint for fetching news articles
router.get('/articles', newsController_1.getArticles);
exports.default = router;
