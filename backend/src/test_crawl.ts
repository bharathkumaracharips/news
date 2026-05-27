import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFetch(url: string) {
  console.log('\n----------------------------------------');
  console.log('Testing direct crawl for:', url);
  try {
    const res = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      }
    });
    console.log('Status code:', res.status);
    console.log('HTML length:', res.data.length);
    
    const $ = cheerio.load(res.data);
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      paragraphs.push($(el).text().trim());
    });
    
    console.log('Found paragraphs:', paragraphs.length);
    console.log('Sample paragraphs:', paragraphs.filter(p => p.length > 20).slice(0, 5));
  } catch (err: any) {
    console.error('Error fetching URL:', err.message);
    if (err.response) {
      console.log('Response Status:', err.response.status);
      console.log('Response Headers:', err.response.headers);
      console.log('Response Data Snippet:', err.response.data.substring(0, 1000));
    }
  }
}

async function run() {
  // Test Moneycontrol
  await testFetch('https://www.moneycontrol.com/news/india/cabinet-approves-sarthak-pds-scheme-to-modernise-ration-system-support-grain-transport-1273380.html');
  
  // Test Business Standard
  await testFetch('https://www.business-standard.com/industry/banking/sebi-seeks-feedback-on-new-options-strike-price-mechanism-124052700562_1.html');
}

run();
