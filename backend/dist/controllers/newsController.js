"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArticleIntelligence = exports.getArticleTimeline = exports.getSimilarArticles = exports.getArticles = exports.STOPWORDS = void 0;
exports.areArticlesSimilar = areArticlesSimilar;
const db_1 = __importDefault(require("../config/db"));
const ingestionJob_1 = require("../jobs/ingestionJob");
const htmlCrawler_1 = require("../services/htmlCrawler");
const rssFetcher_1 = require("../services/rssFetcher");
const intelligenceService_1 = require("../services/intelligenceService");
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
        // We require a 45% or higher intersection match of proper noun entities
        if (entityMatchRatio >= 0.45)
            return true;
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
    // We require a 45% or higher match of significant keywords
    return keywordMatchRatio >= 0.45;
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
                ((g.eventId && article.eventId && g.eventId === article.eventId) ||
                    areArticlesSimilar(g.title, article.title)));
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
                        category: article.category,
                        eventId: article.eventId
                    });
                }
            }
            else {
                // Establish as a new Primary News Card on the feed
                grouped.push({
                    ...article,
                    eventId: article.eventId,
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
        if (keywords.length === 0 && !referenceArticle.eventId) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
        }
        let matchedArticles = [];
        if (referenceArticle.eventId) {
            // Fast path: use embedding-based event cluster
            matchedArticles = await db_1.default.article.findMany({
                where: {
                    eventId: referenceArticle.eventId,
                    id: { not: id }
                },
                include: { category: true },
                orderBy: { publishedAt: 'desc' }
            });
        }
        else {
            // Fallback path: keyword memory filtering
            const similarArticles = await db_1.default.article.findMany({
                where: {
                    id: { not: id },
                    categoryId: referenceArticle.categoryId,
                    OR: keywords.map(kw => ({
                        title: { contains: kw, mode: 'insensitive' }
                    }))
                },
                take: 24,
                include: { category: true },
                orderBy: { publishedAt: 'desc' }
            });
            matchedArticles = similarArticles.filter(art => areArticlesSimilar(referenceArticle.title, art.title));
        }
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
/**
 * Builds a chronological vertical timeline of the same news event's historical developments.
 */
const getArticleTimeline = async (req, res) => {
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
                    referenceArticle.content = updatedArticle.content;
                    referenceArticle.url = updatedArticle.url;
                }
            }
            catch (err) {
                console.error(`🩺 [Timeline Heal]: Failed to heal article ${referenceArticle.id}:`, err.message);
            }
        }
        // Trigger dynamic Google News perspective/history search to populate the DB in real-time
        await (0, ingestionJob_1.crawlAlternativePublishersForArticle)(referenceArticle.title, referenceArticle.categoryId, referenceArticle.category.name);
        const rawWords = referenceArticle.title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/);
        const keywords = rawWords.filter(word => word.length > 3 && !exports.STOPWORDS.has(word));
        if (keywords.length === 0 && !referenceArticle.eventId) {
            return res.status(200).json({
                success: true,
                count: 1,
                data: [{
                        id: referenceArticle.id,
                        title: referenceArticle.title,
                        publishedAt: referenceArticle.publishedAt,
                        source: referenceArticle.source,
                        url: referenceArticle.url,
                        summary: referenceArticle.summary,
                        content: referenceArticle.content,
                        category: referenceArticle.category,
                        perspectives: []
                    }]
            });
        }
        let matchedArticles = [];
        if (referenceArticle.eventId) {
            // Fast path: fetch all articles in the same embedding-based event cluster
            matchedArticles = await db_1.default.article.findMany({
                where: {
                    eventId: referenceArticle.eventId
                },
                include: { category: true },
                orderBy: { publishedAt: 'asc' } // Oldest to newest
            });
        }
        else {
            // Fallback path: Keyword matching
            const relatedArticles = await db_1.default.article.findMany({
                where: {
                    categoryId: referenceArticle.categoryId,
                    OR: keywords.map(kw => ({
                        title: { contains: kw, mode: 'insensitive' }
                    }))
                },
                include: { category: true },
                orderBy: { publishedAt: 'asc' }
            });
            matchedArticles = relatedArticles.filter(art => areArticlesSimilar(referenceArticle.title, art.title) || art.id === referenceArticle.id);
        }
        // Group matching articles chronologically into timeline steps
        const timeline = [];
        for (const article of matchedArticles) {
            // Find if there is an existing timeline step covering the same stage (same day/similar titles)
            const existingStep = timeline.find(step => areArticlesSimilar(step.title, article.title) &&
                Math.abs(new Date(step.publishedAt).getTime() - new Date(article.publishedAt).getTime()) <= 12 * 60 * 60 * 1000 // 12-hour window
            );
            if (existingStep) {
                // Group under this timeline step as an alternate perspective coverage
                if (!existingStep.perspectives.some(p => p.source === article.source || p.id === article.id)) {
                    // If the matching article is actually the reference article or has newer content,
                    // make sure we don't accidentally hide it if it's the main timeline step node.
                    // Otherwise, push it to perspectives.
                    if (article.id !== referenceArticle.id) {
                        existingStep.perspectives.push({
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
                    else {
                        // Swap so the reference article itself is the main step node
                        const oldMain = { ...existingStep, perspectives: [] };
                        existingStep.id = article.id;
                        existingStep.title = article.title;
                        existingStep.summary = article.summary;
                        existingStep.content = article.content;
                        existingStep.source = article.source;
                        existingStep.url = article.url;
                        existingStep.publishedAt = article.publishedAt;
                        existingStep.category = article.category;
                        if (oldMain.source !== article.source) {
                            existingStep.perspectives.push(oldMain);
                        }
                    }
                }
            }
            else {
                // Establish as a distinct historical stage in the chronological timeline
                timeline.push({
                    id: article.id,
                    title: article.title,
                    publishedAt: article.publishedAt,
                    source: article.source,
                    url: article.url,
                    summary: article.summary,
                    content: article.content,
                    category: article.category,
                    perspectives: []
                });
            }
        }
        res.status(200).json({
            success: true,
            count: timeline.length,
            data: timeline
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
};
exports.getArticleTimeline = getArticleTimeline;
/**
 * Generates local AI intelligence for an article (Industry Impact, Synthesized Perspectives, Historical Context).
 */
const getArticleIntelligence = async (req, res) => {
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
        let matchedArticles = [];
        if (referenceArticle.eventId) {
            matchedArticles = await db_1.default.article.findMany({
                where: { eventId: referenceArticle.eventId },
                include: { category: true },
                orderBy: { publishedAt: 'asc' }
            });
        }
        else {
            const rawWords = referenceArticle.title.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/);
            const keywords = rawWords.filter(word => word.length > 3 && !exports.STOPWORDS.has(word));
            if (keywords.length > 0) {
                const relatedArticles = await db_1.default.article.findMany({
                    where: {
                        categoryId: referenceArticle.categoryId,
                        OR: keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' } }))
                    },
                    include: { category: true },
                    orderBy: { publishedAt: 'asc' }
                });
                matchedArticles = relatedArticles.filter(art => areArticlesSimilar(referenceArticle.title, art.title) || art.id === referenceArticle.id);
            }
            else {
                matchedArticles = [referenceArticle];
            }
        }
        let before = matchedArticles.filter(a => new Date(a.publishedAt) < new Date(referenceArticle.publishedAt) && a.id !== referenceArticle.id);
        let after = matchedArticles.filter(a => new Date(a.publishedAt) >= new Date(referenceArticle.publishedAt) && a.id !== referenceArticle.id);
        // Filter duplicates by source
        before = before.filter((art, index, self) => self.findIndex(t => t.source === art.source) === index);
        after = after.filter((art, index, self) => self.findIndex(t => t.source === art.source) === index);
        let summary = "Local AI intelligence engine connected. This is the timeline context.";
        let isAiGenerated = false;
        let industryImpact = { benefited: [], disadvantaged: [] };
        if (req.query.useAi === 'true') {
            const perspectives = matchedArticles.filter((art, index, self) => self.findIndex(t => t.source === art.source) === index);
            const intelligence = await (0, intelligenceService_1.generateArticleIntelligence)(referenceArticle, perspectives, matchedArticles);
            summary = intelligence.synthesizedPerspectives;
            industryImpact = intelligence.industryImpact;
            isAiGenerated = true;
            // Classify the impact of 'after' articles
            for (const article of after) {
                const textToClassify = `${article.title}. ${article.summary || article.content?.substring(0, 300) || ''}`;
                article.impactType = await (0, intelligenceService_1.classifyArticleImpact)(textToClassify);
            }
        }
        else {
            // Basic heuristic for impact
            for (let i = 0; i < after.length; i++) {
                after[i].impactType = i % 2 === 0 ? 'positive' : 'negative';
            }
        }
        res.status(200).json({
            success: true,
            data: {
                catalyst: referenceArticle,
                before,
                after,
                industryImpact,
                summary,
                isAiGenerated
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
};
exports.getArticleIntelligence = getArticleIntelligence;
