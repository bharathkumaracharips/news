"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndNormalizeFeed = fetchAndNormalizeFeed;
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default({
    customFields: {
        item: ['summary', 'description', 'pubDate'],
    }
});
/**
 * Fetches an RSS feed from a given URL and normalizes its articles.
 * @param rssUrl The XML Feed URL
 * @param sourceName The display name of the news source
 */
async function fetchAndNormalizeFeed(rssUrl, sourceName) {
    try {
        console.log(`📡 [rssFetcher]: Fetching feed: ${sourceName} (${rssUrl})`);
        // Parse the RSS XML feed using rss-parser
        const feed = await parser.parseURL(rssUrl);
        if (!feed.items || feed.items.length === 0) {
            console.log(`⚠️ [rssFetcher]: No items found in feed for ${sourceName}`);
            return [];
        }
        const normalized = feed.items.map((item) => {
            const title = item.title || 'Untitled Article';
            const url = item.link || '';
            // Fallback strategies for fetching summary and content
            const summarySnippet = item.contentSnippet || item.summary || item.description || '';
            const summary = summarySnippet.length > 300
                ? `${summarySnippet.substring(0, 297)}...`
                : summarySnippet;
            const content = item.content || item.contentSnippet || item.description || 'No content available.';
            const externalId = item.guid || url || `${sourceName}-${title}`;
            // Ensure time is normalized to UTC
            let publishedAt = new Date();
            if (item.pubDate || item.isoDate) {
                const parsedDate = new Date(item.pubDate || item.isoDate || '');
                if (!isNaN(parsedDate.getTime())) {
                    publishedAt = parsedDate;
                }
            }
            return {
                title,
                summary: summary || 'No summary available.',
                content,
                url,
                source: sourceName,
                externalId,
                publishedAt
            };
        });
        console.log(`✅ [rssFetcher]: Normalized ${normalized.length} articles from ${sourceName}`);
        return normalized;
    }
    catch (error) {
        console.error(`❌ [rssFetcher]: Error parsing feed from ${sourceName} (${rssUrl}):`, error.message);
        return [];
    }
}
