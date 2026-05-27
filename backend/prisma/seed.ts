import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🌱 Starting database seeding...');

  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Clear existing data to prevent duplicates
    console.log('Clearing existing data...');
    await prisma.article.deleteMany({});
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

    // 3. Define and Insert Top Story
    console.log('Inserting top story...');
    await prisma.article.create({
      data: {
        title: 'RBI Announces New Monetary Policy Reforms Amid Global Inflation Concerns',
        summary: 'In a sweeping set of changes, the central bank has adjusted the repo rate and introduced new guidelines for digital transactions to stabilize the market.',
        content: 'In a sweeping set of changes, the central bank has adjusted the repo rate and introduced new guidelines for digital transactions to stabilize the market. This policy shift comes amidst mounting global inflation and supply constraints.',
        url: 'https://reuters.com/news/rbi-monetary-policy-reforms',
        source: 'Reuters',
        isTopStory: true,
        isTopDevelopment: false,
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        categoryId: createdCategories['Business & Economy'].id
      }
    });

    // 4. Define and Insert Top Developments
    console.log('Inserting top developments...');
    const developments = [
      {
        title: 'Supreme Court Issues Landmark Ruling on Electoral Bonds',
        category: 'Politics & Governance',
        source: 'The Hindu',
        url: 'https://thehindu.com/news/supreme-court-ruling-electoral-bonds',
        hoursAgo: 4
      },
      {
        title: 'Semiconductor Manufacturing Subsidies Increased by $2 Billion',
        category: 'Technology & Infrastructure',
        source: 'Economic Times',
        url: 'https://economictimes.com/news/semiconductor-manufacturing-subsidies',
        hoursAgo: 5
      },
      {
        title: 'Border Tensions Escalate: Diplomatic Talks Scheduled for Next Week',
        category: 'National Security & Defense',
        source: 'AP',
        url: 'https://ap.org/news/border-tensions-escalate-talks',
        hoursAgo: 7
      }
    ];

    for (const dev of developments) {
      await prisma.article.create({
        data: {
          title: dev.title,
          summary: `${dev.title} coverage from ${dev.source}.`,
          content: `Complete coverage of: ${dev.title}. Discussions and implications are ongoing.`,
          url: dev.url,
          source: dev.source,
          isTopStory: false,
          isTopDevelopment: true,
          publishedAt: new Date(Date.now() - dev.hoursAgo * 60 * 60 * 1000),
          categoryId: createdCategories[dev.category].id
        }
      });
    }

    // 5. Define and Insert Standard Articles
    console.log('Inserting standard articles...');
    const standardArticles = [
      {
        title: 'Parliament Passes New Infrastructure Bill Aimed at Rural Connectivity',
        category: 'Politics & Governance',
        source: 'PIB',
        url: 'https://pib.gov/news/parliament-passes-infrastructure-bill',
        hoursAgo: 1
      },
      {
        title: 'Major Layoffs Announced at Top Tech Firms Amid AI Transition',
        category: 'Business & Economy',
        source: 'Financial Times',
        url: 'https://ft.com/news/tech-firms-layoffs-ai-transition',
        hoursAgo: 3
      },
      {
        title: 'CBI Launches Investigation into Multi-State Cyber Fraud Ring',
        category: 'Crime & Justice',
        source: 'Indian Express',
        url: 'https://indianexpress.com/news/cbi-investigation-cyber-fraud-ring',
        hoursAgo: 4
      },
      {
        title: 'Global Supply Chain Disruptions Expected Following New Trade Tariffs',
        category: 'World Affairs',
        source: 'Bloomberg',
        url: 'https://bloomberg.com/news/global-supply-chain-tariffs',
        hoursAgo: 6
      },
      {
        title: 'Breakthrough in Fusion Energy Could Redefine Climate Goals',
        category: 'Science & Environment',
        source: 'BBC',
        url: 'https://bbc.com/news/breakthrough-fusion-energy-climate',
        hoursAgo: 8
      },
      {
        title: 'Cyber Warfare Command Intercepts Coordinated Attack on Grid',
        category: 'National Security & Defense',
        source: 'Wired',
        url: 'https://wired.com/news/cyber-warfare-grid-attack',
        hoursAgo: 10
      },
      {
        title: 'New AI Regulations Proposed to Protect Enterprise Data',
        category: 'Technology & Infrastructure',
        source: 'TechCrunch',
        url: 'https://techcrunch.com/news/new-ai-regulations-proposed',
        hoursAgo: 12
      }
    ];

    for (const art of standardArticles) {
      await prisma.article.create({
        data: {
          title: art.title,
          summary: `Latest details on ${art.title}.`,
          content: `Full analysis and reporting on: ${art.title}. Local officials and industry experts continue to weigh in.`,
          url: art.url,
          source: art.source,
          isTopStory: false,
          isTopDevelopment: false,
          publishedAt: new Date(Date.now() - art.hoursAgo * 60 * 60 * 1000),
          categoryId: createdCategories[art.category].id
        }
      });
    }

    console.log('✅ Seeding completed successfully!');
  } finally {
    // Gracefully disconnect and shut down the postgres connection client pool
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seeding error:', e);
  process.exit(1);
});
