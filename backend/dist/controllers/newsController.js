"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimilarArticles = exports.getArticles = exports.STOPWORDS = void 0;
exports.areArticlesSimilar = areArticlesSimilar;
const db_1 = __importDefault(require("../config/db"));
const ingestionJob_1 = require("../jobs/ingestionJob");
const htmlCrawler_1 = require("../services/htmlCrawler");
const rssFetcher_1 = require("../services/rssFetcher");
exports.STOPWORDS = new Set([
    'this', 'that', 'with', 'from', 'your', 'have', 'more', 'about', 'will', 'than',
    'what', 'when', 'were', 'been', 'would', 'their', 'there', 'some', 'other', 'into',
    'over', 'also', 'only', 'amid', 'says', 'said', 'news', 'after', 'does', 'just',
    'where', 'which', 'their', 'these', 'under', 'upholds', 'first', 'second', 'third'
]);
/**
 * Checks if two article titles cover the exact same news event by comparing
 * their dynamically extracted proper noun entities and requiring a 70% or higher match.
 */
function areArticlesSimilar(titleA, titleB) {
    const getEntities = (title) => {
        return new Set(title
            .split(/\s+/)
            .map(w => w.replace(/[^\w]/g, ''))
            .filter(w => w.length > 2 && /^[A-Z]/.test(w))
            .map(w => w.toLowerCase()));
    };
    const entitiesA = getEntities(titleA);
    const entitiesB = getEntities(titleB);
    // If both titles have proper noun entities, check their intersection percentage
    if (entitiesA.size > 0 && entitiesB.size > 0) {
        let matches = 0;
        for (const ent of entitiesA) {
            if (entitiesB.has(ent)) {
                matches++;
            }
        }
        const smallerSize = Math.min(entitiesA.size, entitiesB.size);
        const entityMatchRatio = matches / smallerSize;
        // We require a 70% or higher intersection match of proper noun entities
        return entityMatchRatio >= 0.70;
    }
    // Fallback if one or both titles have no proper noun entities
    const getSignificantWords = (title) => {
        return new Set(title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !exports.STOPWORDS.has(w)));
    };
    const wordsA = getSignificantWords(titleA);
    const wordsB = getSignificantWords(titleB);
    if (wordsA.size === 0 || wordsB.size === 0) {
        return false;
    }
    let matches = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) {
            matches++;
        }
    }
    const smallerSize = Math.min(wordsA.size, wordsB.size);
    const keywordMatchRatio = matches / smallerSize;
    // We require a 70% or higher match of significant keywords
    return keywordMatchRatio >= 0.70;
}
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
            console.log(`⚡️ [API]: User requested "${category}". Triggering priority on-demand crawler...`);
            (0, ingestionJob_1.crawlCategorySourcesOnDemand)(String(category)).catch((err) => {
                console.error(`❌ [API]: Background priority sync failed:`, err.message);
            });
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
        // Dynamic clustering and grouping by news event topic
        const grouped = [];
        for (const article of fetchedArticles) {
            // Find if this article is similar to an already selected primary news event
            const match = grouped.find(g => g.categoryId === article.categoryId &&
                areArticlesSimilar(g.title, article.title));
            if (match) {
                // Group under the primary card as a distinct perspective
                // Ensure we don't duplicate the exact same source publisher twice in the stack
                if (!match.perspectives.some(p => p.source === article.source)) {
                    match.perspectives.push({
                        id: article.id,
                        title: article.title,
                        summary: article.summary,
                        content: article.content,
                        source: article.source,
                        url: article.url,
                        publishedAt: article.publishedAt,
                        category: article.category
                    });
                }
            }
            else {
                // Establish as a new Primary News Card on the feed
                grouped.push({
                    ...article,
                    perspectives: []
                });
            }
        }
        res.status(200).json({
            success: true,
            count: grouped.length,
            data: grouped,
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
/**
 * Searches the database for similar articles from other publishers (Perspective Stacking)
 */
const getSimilarArticles = async (req, res) => {
    try {
        const { id } = req.params;
        const referenceArticle = await db_1.default.article.findUnique({
            where: { id },
            include: { category: true }
        });
        if (!referenceArticle) {
            return res.status(404).json({
                success: false,
                message: 'Article not found'
            });
        }
        // Dynamically heal the reference article itself in real-time if its content is a short headline-only placeholder (e.g., < 500 chars)
        if (!referenceArticle.content || referenceArticle.content.length < 500 || referenceArticle.content.startsWith('Tap visiting source')) {
            const directUrl = (0, rssFetcher_1.decodeGoogleNewsUrl)(referenceArticle.url);
            try {
                const crawledBody = await (0, htmlCrawler_1.crawlArticleContent)(directUrl);
                if (crawledBody && crawledBody.length > 150) {
                    const updatedArticle = await db_1.default.article.update({
                        where: { id: referenceArticle.id },
                        data: {
                            url: directUrl,
                            content: crawledBody
                        },
                        include: { category: true }
                    });
                    // Update referenceArticle object in memory for downstream similar search matching
                    referenceArticle.content = updatedArticle.content;
                    referenceArticle.url = updatedArticle.url;
                    console.log(`🩺 [Real-Time Heal]: Instantly healed content for [${referenceArticle.source}]: "${referenceArticle.title}"`);
                }
                else {
                    // Update URL even if crawl fails so that it has the correct direct URL
                    const updatedArticle = await db_1.default.article.update({
                        where: { id: referenceArticle.id },
                        data: { url: directUrl },
                        include: { category: true }
                    });
                    referenceArticle.url = updatedArticle.url;
                }
            }
            catch (err) {
                console.error(`🩺 [Real-Time Heal]: Failed to heal article ${referenceArticle.id}:`, err.message);
            }
        }
        // Dynamically crawl alternative publishers for the exact same event on-demand in real-time
        await (0, ingestionJob_1.crawlAlternativePublishersForArticle)(referenceArticle.title, referenceArticle.categoryId, referenceArticle.category.name);
        const rawWords = referenceArticle.title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/);
        const keywords = rawWords.filter(word => word.length > 3 && !exports.STOPWORDS.has(word));
        if (keywords.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }
        const similarArticles = await db_1.default.article.findMany({
            where: {
                id: { not: id },
                categoryId: referenceArticle.categoryId,
                OR: keywords.map(kw => ({
                    title: { contains: kw, mode: 'insensitive' }
                }))
            },
            take: 24, // Pull a larger pool to allow high-precision memory filtering
            include: {
                category: true
            },
            orderBy: {
                publishedAt: 'desc'
            }
        });
        // Memory filter using high-precision similarity check
        const matchedArticles = similarArticles.filter(art => areArticlesSimilar(referenceArticle.title, art.title));
        // Remove duplicates from the same publisher
        const uniqueSimilar = matchedArticles.filter((art, index, self) => self.findIndex(t => t.source === art.source) === index);
        res.status(200).json({
            success: true,
            count: uniqueSimilar.length,
            data: uniqueSimilar
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
};
exports.getSimilarArticles = getSimilarArticles;
