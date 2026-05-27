"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeGoogleNewsUrl = decodeGoogleNewsUrl;
exports.fetchAndNormalizeFeed = fetchAndNormalizeFeed;
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default({
    customFields: {
        item: ['summary', 'description', 'pubDate'],
    }
});
/**
 * Safely strips HTML tags and normalizes entities to return clean text.
 */
function stripHtml(htmlStr) {
    if (!htmlStr)
        return '';
    return htmlStr
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML spaces
        .replace(/&amp;/g, '&') // Replace ampersands
        .replace(/&lt;/g, '<') // Replace less than
        .replace(/&gt;/g, '>') // Replace greater than
        .replace(/&quot;/g, '"') // Replace double quotes
        .replace(/\s+/g, ' ') // Normalize whitespaces
        .trim();
}
/**
 * Dynamically decodes the actual target publisher URL from a Google News article redirect link.
 */
function decodeGoogleNewsUrl(url) {
    if (!url.includes('news.google.com/rss/articles/')) {
        return url;
    }
    try {
        const parts = url.split('news.google.com/rss/articles/');
        if (parts.length < 2)
            return url;
        const token = parts[1].split('?')[0];
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        // Extract the valid http/https URL from the decoded text (excluding trailing control chars)
        const match = decoded.match(/https?:\/\/[^\s"'<>\(\)\uFFFD\u0000-\u001F]+/);
        if (match) {
            return match[0];
        }
        return url;
    }
    catch (err) {
        console.error('Error decoding Google News URL:', err);
        return url;
    }
}
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
            const title = stripHtml(item.title || 'Untitled Article');
            const url = item.link || '';
            let finalTitle = title;
            let finalSource = sourceName;
            let finalUrl = url;
            // Extract real publisher brand and clean title from Google News search results
            if (sourceName === 'Google News Dynamic Search' || sourceName.includes('Google News')) {
                const lastDashIndex = title.lastIndexOf(' - ');
                if (lastDashIndex !== -1) {
                    finalTitle = title.substring(0, lastDashIndex).trim();
                    finalSource = title.substring(lastDashIndex + 3).trim();
                }
                finalUrl = decodeGoogleNewsUrl(url);
            }
            // Fallback strategies for fetching summary and content
            const summarySnippet = stripHtml(item.contentSnippet || item.summary || item.description || '');
            const summary = summarySnippet.length > 300
                ? `${summarySnippet.substring(0, 297)}...`
                : summarySnippet;
            const rawContent = item.content || item.contentSnippet || item.description || 'No content available.';
            const content = stripHtml(rawContent);
            const externalId = item.guid || finalUrl || `${finalSource}-${finalTitle}`;
            // Ensure time is normalized to UTC
            let publishedAt = new Date();
            if (item.pubDate || item.isoDate) {
                const parsedDate = new Date(item.pubDate || item.isoDate || '');
                if (!isNaN(parsedDate.getTime())) {
                    publishedAt = parsedDate;
                }
            }
            return {
                title: finalTitle,
                summary: summary || 'No summary available.',
                content: content || 'Tap visiting source button below to read full documentation and insights.',
                url: finalUrl,
                source: finalSource,
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
