"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.cosineSimilarity = cosineSimilarity;
exports.computeCentroid = computeCentroid;
exports.findMatchingEvent = findMatchingEvent;
exports.assignArticleToEvent = assignArticleToEvent;
exports.backfillEmbeddings = backfillEmbeddings;
const transformers_1 = require("@xenova/transformers");
const db_1 = __importDefault(require("../config/db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SIMILARITY_THRESHOLD = 0.55;
const EVENT_LOOKBACK_DAYS = 7;
let extractor = null;
async function getExtractor() {
    if (!extractor) {
        console.log('⏳ [embeddingService]: Initializing Xenova/all-MiniLM-L6-v2 pipeline...');
        extractor = await (0, transformers_1.pipeline)('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ [embeddingService]: Pipeline initialized.');
    }
    return extractor;
}
/**
 * Generates a 384-dimension embedding vector for a given text input
 * using Xenova/all-MiniLM-L6-v2.
 */
async function generateEmbedding(text) {
    try {
        const cleanText = text.trim().substring(0, 512); // Cap input length
        if (!cleanText)
            return [];
        const ext = await getExtractor();
        const output = await ext(cleanText, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
    catch (error) {
        console.error('❌ [embeddingService]: Embedding generation failed:', error.message);
        return [];
    }
}
/**
 * Computes cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0)
        return 0;
    return dotProduct / magnitude;
}
/**
 * Computes the centroid (average) of multiple embedding vectors.
 * Used to maintain a representative vector for a NewsEvent cluster.
 */
function computeCentroid(embeddings) {
    if (embeddings.length === 0)
        return [];
    if (embeddings.length === 1)
        return [...embeddings[0]];
    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);
    for (const emb of embeddings) {
        for (let i = 0; i < dim; i++) {
            centroid[i] += emb[i];
        }
    }
    for (let i = 0; i < dim; i++) {
        centroid[i] /= embeddings.length;
    }
    return centroid;
}
/**
 * Finds the best matching NewsEvent for a given embedding vector.
 * Searches recent events (within EVENT_LOOKBACK_DAYS) in the same category.
 * Returns the event and its similarity score, or null if no match above threshold.
 */
async function findMatchingEvent(embedding, categoryId) {
    if (embedding.length === 0)
        return null;
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - EVENT_LOOKBACK_DAYS);
    // Load recent events in the same category that have embeddings
    const recentEvents = await db_1.default.newsEvent.findMany({
        where: {
            categoryId,
            lastSeenAt: { gte: lookbackDate },
        },
        select: {
            id: true,
            title: true,
            embedding: true,
        },
    });
    let bestMatch = null;
    for (const event of recentEvents) {
        if (!event.embedding || event.embedding.length === 0)
            continue;
        const similarity = cosineSimilarity(embedding, event.embedding);
        if (similarity >= SIMILARITY_THRESHOLD) {
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { event, similarity };
            }
        }
    }
    return bestMatch;
}
/**
 * Assigns an article to an existing NewsEvent or creates a new one.
 * This is the core clustering function called during article ingestion.
 *
 * Flow:
 * 1. Generate embedding for article title + summary
 * 2. Search for matching events by cosine similarity
 * 3. If match found (≥ 0.82), attach article to event and update centroid
 * 4. If no match, create a new event seeded by this article
 */
async function assignArticleToEvent(articleId) {
    try {
        const article = await db_1.default.article.findUnique({
            where: { id: articleId },
            include: { category: true },
        });
        if (!article)
            return;
        // Build embedding input: title + summary for maximum signal
        const embeddingInput = `${article.title}${article.summary ? ' — ' + article.summary : ''}`;
        const embedding = await generateEmbedding(embeddingInput);
        if (embedding.length === 0) {
            console.warn(`⚠️ [embeddingService]: Skipping clustering for article "${article.title}" (empty embedding)`);
            return;
        }
        // Save embedding to the article
        await db_1.default.article.update({
            where: { id: articleId },
            data: { embedding },
        });
        // Find best matching event
        const match = await findMatchingEvent(embedding, article.categoryId);
        if (match) {
            // Attach to existing event
            const event = await db_1.default.newsEvent.findUnique({
                where: { id: match.event.id },
                include: { articles: { select: { embedding: true } } },
            });
            if (!event)
                return;
            // Update article with event reference
            await db_1.default.article.update({
                where: { id: articleId },
                data: { eventId: event.id },
            });
            // Recompute centroid with the new article's embedding included
            const allEmbeddings = event.articles
                .map(a => a.embedding)
                .filter(e => e.length > 0);
            allEmbeddings.push(embedding);
            const newCentroid = computeCentroid(allEmbeddings);
            // Update event metadata
            await db_1.default.newsEvent.update({
                where: { id: event.id },
                data: {
                    embedding: newCentroid,
                    articleCount: { increment: 1 },
                    lastSeenAt: article.publishedAt > event.lastSeenAt ? article.publishedAt : event.lastSeenAt,
                    firstSeenAt: article.publishedAt < event.firstSeenAt ? article.publishedAt : event.firstSeenAt,
                },
            });
            console.log(`🔗 [embeddingService]: Clustered "${article.title.substring(0, 50)}..." → Event "${event.title.substring(0, 50)}..." (similarity: ${match.similarity.toFixed(3)})`);
        }
        else {
            // Create a new event seeded by this article
            const newEvent = await db_1.default.newsEvent.create({
                data: {
                    title: article.title,
                    summary: article.summary,
                    categoryId: article.categoryId,
                    embedding,
                    articleCount: 1,
                    firstSeenAt: article.publishedAt,
                    lastSeenAt: article.publishedAt,
                },
            });
            // Link article to the new event
            await db_1.default.article.update({
                where: { id: articleId },
                data: { eventId: newEvent.id },
            });
            console.log(`🆕 [embeddingService]: Created new event "${article.title.substring(0, 60)}..."`);
        }
    }
    catch (error) {
        console.error(`❌ [embeddingService]: Event assignment failed for article ${articleId}:`, error.message);
    }
}
/**
 * Backfills embeddings and event clusters for all existing articles
 * that don't have an embedding yet. Runs 100% locally.
 */
async function backfillEmbeddings() {
    console.log('🔄 [embeddingService]: Starting embedding backfill for all unclustered articles...');
    const articles = await db_1.default.article.findMany({
        where: {
            OR: [
                { embedding: { isEmpty: true } },
                { eventId: null },
            ],
        },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true },
    });
    console.log(`🔄 [embeddingService]: Found ${articles.length} articles to process.`);
    let processed = 0;
    let errors = 0;
    for (const article of articles) {
        try {
            await assignArticleToEvent(article.id);
            processed++;
            if (processed % 50 === 0) {
                console.log(`🔄 [embeddingService]: Backfill progress: ${processed}/${articles.length}`);
            }
        }
        catch (err) {
            console.error(`❌ [backfill]: Failed to process article "${article.title}":`, err.message);
            errors++;
        }
    }
    const eventCount = await db_1.default.newsEvent.count();
    console.log(`✅ [embeddingService]: Backfill complete! Processed: ${processed}, Events created: ${eventCount}, Errors: ${errors}`);
    return { processed, events: eventCount, errors };
}
