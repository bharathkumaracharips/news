import Parser from 'rss-parser';

export interface NormalizedArticle {
  title: string;
  summary: string;
  content: string;
  url: string;
  source: string;
  externalId: string;
  publishedAt: Date;
}

const parser = new Parser({
  customFields: {
    item: ['summary', 'description', 'pubDate'],
  }
});

/**
 * Safely strips HTML tags and normalizes entities to return clean text.
 */
function stripHtml(htmlStr: string): string {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&nbsp;/g, ' ')  // Replace HTML spaces
    .replace(/&amp;/g, '&')   // Replace ampersands
    .replace(/&lt;/g, '<')    // Replace less than
    .replace(/&gt;/g, '>')    // Replace greater than
    .replace(/&quot;/g, '"')  // Replace double quotes
    .replace(/\s+/g, ' ')     // Normalize whitespaces
    .trim();
}

/**
 * Fetches an RSS feed from a given URL and normalizes its articles.
 * @param rssUrl The XML Feed URL
 * @param sourceName The display name of the news source
 */
export async function fetchAndNormalizeFeed(
  rssUrl: string,
  sourceName: string
): Promise<NormalizedArticle[]> {
  try {
    console.log(`📡 [rssFetcher]: Fetching feed: ${sourceName} (${rssUrl})`);
    
    // Parse the RSS XML feed using rss-parser
    const feed = await parser.parseURL(rssUrl);
    
    if (!feed.items || feed.items.length === 0) {
      console.log(`⚠️ [rssFetcher]: No items found in feed for ${sourceName}`);
      return [];
    }

    const normalized: NormalizedArticle[] = feed.items.map((item) => {
      const title = stripHtml(item.title || 'Untitled Article');
      const url = item.link || '';
      
      let finalTitle = title;
      let finalSource = sourceName;

      // Extract real publisher brand and clean title from Google News search results
      if (sourceName === 'Google News Dynamic Search' || sourceName.includes('Google News')) {
        const lastDashIndex = title.lastIndexOf(' - ');
        if (lastDashIndex !== -1) {
          finalTitle = title.substring(0, lastDashIndex).trim();
          finalSource = title.substring(lastDashIndex + 3).trim();
        }
      }

      // Fallback strategies for fetching summary and content
      const summarySnippet = stripHtml(item.contentSnippet || item.summary || item.description || '');
      const summary = summarySnippet.length > 300 
        ? `${summarySnippet.substring(0, 297)}...` 
        : summarySnippet;

      const rawContent = item.content || item.contentSnippet || item.description || 'No content available.';
      const content = stripHtml(rawContent);
      const externalId = item.guid || url || `${finalSource}-${finalTitle}`;
      
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
        url,
        source: finalSource,
        externalId,
        publishedAt
      };
    });

    console.log(`✅ [rssFetcher]: Normalized ${normalized.length} articles from ${sourceName}`);
    return normalized;
  } catch (error: any) {
    console.error(`❌ [rssFetcher]: Error parsing feed from ${sourceName} (${rssUrl}):`, error.message);
    return [];
  }
}
