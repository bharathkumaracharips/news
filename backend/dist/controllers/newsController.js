"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArticles = void 0;
const db_1 = __importDefault(require("../config/db"));
const getArticles = async (req, res) => {
    try {
        const { category, isTopStory, isTopDevelopment } = req.query;
        const whereClause = {};
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
        const fetchedArticles = await db_1.default.article.findMany({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error',
        });
    }
};
exports.getArticles = getArticles;
