import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🌱 Reseeding database with highly active Indian and Global RSS Sources...');

  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Clear existing data to prevent duplicates and clean up inactive feeds
    console.log('Clearing existing data...');
    await prisma.article.deleteMany({});
    await prisma.newsSource.deleteMany({});
    await prisma.category.deleteMany({});

    // 2. Define standard categories matching NewsCategory
    const categoriesData = [
      { name: 'Politics & Governance' },
      { name: 'Business & Economy' },
      { name: 'Crime & Justice' },
      { name: 'World Affairs' },
      { name: 'Technology & Infrastructure' },
      { name: 'Science & Environment' },
      { name: 'National Security & Defense' }
    ];

    console.log('Inserting categories...');
    const createdCategories: Record<string, any> = {};
    for (const cat of categoriesData) {
      const created = await prisma.category.create({
        data: cat
      });
      createdCategories[cat.name] = created;
    }

    // 3. Define and Insert 10-15 highly active premium RSS feeds
    console.log('Inserting highly active RSS News Sources...');
    const sourcesData = [
      // --- VERY ACTIVE INDIAN NEWS SOURCES ---
      {
        name: 'Google News India National (Politics & Gov)',
        rssUrl: 'https://news.google.com/rss/headlines/section/geo/IN?hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'Politics & Governance'
      },
      {
        name: 'The Hindu National News',
        rssUrl: 'https://www.thehindu.com/news/national/feeder/default.rss',
        categoryName: 'Politics & Governance'
      },
      {
        name: 'Reserve Bank of India (RBI Press Releases)',
        rssUrl: 'https://news.google.com/rss/search?q=Reserve+Bank+of+India+RBI&hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'Business & Economy'
      },
      {
        name: 'Securities and Exchange Board of India (SEBI)',
        rssUrl: 'https://news.google.com/rss/search?q=SEBI+Securities+and+Exchange+Board+of+India&hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'Business & Economy'
      },
      {
        name: 'Economic Times (Indian Economy)',
        rssUrl: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
        categoryName: 'Business & Economy'
      },
      {
        name: 'ISRO strategic space science updates',
        rssUrl: 'https://news.google.com/rss/search?q=ISRO+Indian+Space+Research+Organisation&hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'Science & Environment'
      },
      // --- GLOBAL Reputed & Technology Feeds ---
      {
        name: 'Reuters World News',
        rssUrl: 'https://news.google.com/rss/search?q=source:Reuters',
        categoryName: 'World Affairs'
      },
      {
        name: 'Associated Press (AP)',
        rssUrl: 'https://news.google.com/rss/search?q=source:Associated_Press',
        categoryName: 'World Affairs'
      },
      {
        name: 'BBC News Global',
        rssUrl: 'https://news.google.com/rss/search?q=source:BBC_News',
        categoryName: 'World Affairs'
      },
      {
        name: 'CNBC Finance',
        rssUrl: 'https://search.cnbc.com/rs/search/combined/searchResults.rss?query=finance',
        categoryName: 'Business & Economy'
      },
      {
        name: 'TechCrunch',
        rssUrl: 'https://techcrunch.com/feed/',
        categoryName: 'Technology & Infrastructure'
      },
      {
        name: 'Krebs on Security',
        rssUrl: 'https://krebsonsecurity.com/feed/',
        categoryName: 'National Security & Defense'
      },
      {
        name: 'Indian Defense & Military Intelligence',
        rssUrl: 'https://news.google.com/rss/search?q=defence+India+military+national+security&hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'National Security & Defense'
      },
      {
        name: 'India Crime & Judicial Updates',
        rssUrl: 'https://news.google.com/rss/search?q=crime+justice+court+India&hl=en-IN&gl=IN&ceid=IN:en',
        categoryName: 'Crime & Justice'
      },
      {
        name: 'The Verge',
        rssUrl: 'https://www.theverge.com/rss/index.xml',
        categoryName: 'Technology & Infrastructure'
      }
    ];

    for (const src of sourcesData) {
      await prisma.newsSource.create({
        data: {
          name: src.name,
          rssUrl: src.rssUrl,
          categoryName: src.categoryName,
          isActive: true
        }
      });
    }

    console.log('✅ Highly active feeds seeded successfully!');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seeding error:', e);
  process.exit(1);
});
