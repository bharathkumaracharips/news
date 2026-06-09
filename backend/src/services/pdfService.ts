import { PDFParse } from 'pdf-parse';

export async function extractArticlesFromPdf(buffer: Buffer): Promise<{ title: string, content: string, category: string }[]> {
  console.log('⏳ [pdfService]: Parsing PDF buffer...');
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  await parser.destroy();
  const text = data.text;

  // Extremely basic heuristic to simulate article extraction from raw layout text.
  // We split by double newlines to find paragraphs, then group them into chunked "articles".
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
  
  const articles: { title: string, content: string, category: string }[] = [];
  let currentArticle = '';
  
  for (let i = 0; i < paragraphs.length; i++) {
    currentArticle += paragraphs[i] + ' ';
    // Chunk every 3 substantial paragraphs into a simulated article
    if ((i + 1) % 3 === 0 || i === paragraphs.length - 1) {
      if (currentArticle.length > 200) {
        // First sentence as title
        const firstPeriod = currentArticle.indexOf('.');
        let title = firstPeriod > 10 ? currentArticle.substring(0, firstPeriod) : currentArticle.substring(0, 60) + '...';
        if (title.length > 100) title = title.substring(0, 100) + '...';
        
        // Random category assignment for MVP since we don't want to block UI with 100 zero-shot calls
        const categories = ['Politics & Governance', 'Business & Economy', 'Crime & Justice', 'Technology & Infrastructure', 'Science & Environment'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];

        articles.push({
          title: title.trim(),
          content: currentArticle.trim(),
          category: randomCategory
        });
      }
      currentArticle = '';
    }
  }

  console.log(`✅ [pdfService]: Extracted ${articles.length} simulated articles from PDF.`);
  return articles;
}
