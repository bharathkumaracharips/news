import axios from 'axios';
import * as cheerio from 'cheerio';

const CHAR_LIMIT = 2500; // Limit to ensure extremely low storage footprint
const TIMEOUT_MS = 5000;  // 5 seconds timeout to guarantee no heavy computation or hang blocks

/**
 * Downloads an article's raw HTML and extracts its main body text.
 * Performs cleanups and length truncations to remain extremely resource-efficient.
 * 
 * @param url The target article web page
 */
export async function crawlArticleContent(url: string): Promise<string> {
  if (!url) return '';

  try {
    // 1. Fetch HTML with strict timeouts and standard User-Agent headers
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IngestionCrawler/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const html = response.data;
    if (!html || typeof html !== 'string') {
      return '';
    }

    // 2. Load into Cheerio DOM parser
    const $ = cheerio.load(html);

    // 3. Remove non-content related DOM nodes to avoid ingesting noise
    $('script, style, iframe, nav, header, footer, noscript, svg, aside, .comments, .sidebar, .ad, .advertisement').remove();

    // 4. Try target news selectors for primary content, fallback to main/body
    const targetSelectors = [
      'article',
      '[itemprop="articleBody"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main',
      '.story-content',
      'body'
    ];

    let extractedText = '';

    for (const selector of targetSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Collect text from all paragraphs within the selector
        const paragraphs: string[] = [];
        element.find('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 15) { // Skip tiny fragments
            paragraphs.push(text);
          }
        });

        if (paragraphs.length > 0) {
          extractedText = paragraphs.join('\n\n');
          break;
        } else {
          // If no paragraphs inside, extract raw trimmed text
          const rawText = element.text().trim();
          if (rawText.length > 100) {
            extractedText = rawText;
            break;
          }
        }
      }
    }

    if (!extractedText) {
      return '';
    }

    // 5. Normalize whitespace and layout gaps
    let normalized = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();

    // 6. Enforce strict character limits to satisfy resource constraints
    if (normalized.length > CHAR_LIMIT) {
      normalized = `${normalized.substring(0, CHAR_LIMIT - 3)}...`;
    }

    return normalized;
  } catch (error: any) {
    // Fail silently to avoid interrupting the ingestion pipeline loop
    console.log(`⚠️ [htmlCrawler]: Failed to crawl ${url}: ${error.message}`);
    return '';
  }
}
