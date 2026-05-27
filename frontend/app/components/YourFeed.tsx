'use client';

import Link from 'next/link';
import styles from './YourFeed.module.css';

// Backend Category Structure as requested
export enum NewsCategory {
  POLITICS = 'Politics & Governance',
  BUSINESS = 'Business & Economy',
  CRIME = 'Crime & Justice',
  WORLD = 'World Affairs',
  TECHNOLOGY = 'Technology & Infrastructure',
  SCIENCE = 'Science & Environment',
  SECURITY = 'National Security & Defense',
}

// Dummy data for the UI
const topStory = {
  title: "RBI Announces New Monetary Policy Reforms Amid Global Inflation Concerns",
  excerpt: "In a sweeping set of changes, the central bank has adjusted the repo rate and introduced new guidelines for digital transactions to stabilize the market.",
  category: NewsCategory.BUSINESS,
  source: "Reuters",
  time: "2 hours ago",
};

const topDevelopments = [
  {
    title: "Supreme Court Issues Landmark Ruling on Electoral Bonds",
    category: NewsCategory.POLITICS,
    source: "The Hindu",
    time: "4 hours ago",
  },
  {
    title: "Semiconductor Manufacturing Subsidies Increased by $2 Billion",
    category: NewsCategory.TECHNOLOGY,
    source: "Economic Times",
    time: "5 hours ago",
  },
  {
    title: "Border Tensions Escalate: Diplomatic Talks Scheduled for Next Week",
    category: NewsCategory.SECURITY,
    source: "AP",
    time: "7 hours ago",
  },
];

const standardArticles = [
  {
    title: "Parliament Passes New Infrastructure Bill Aimed at Rural Connectivity",
    category: NewsCategory.POLITICS,
    source: "PIB",
    time: "1 hour ago",
  },
  {
    title: "Major Layoffs Announced at Top Tech Firms Amid AI Transition",
    category: NewsCategory.BUSINESS,
    source: "Financial Times",
    time: "3 hours ago",
  },
  {
    title: "CBI Launches Investigation into Multi-State Cyber Fraud Ring",
    category: NewsCategory.CRIME,
    source: "Indian Express",
    time: "4 hours ago",
  },
  {
    title: "Global Supply Chain Disruptions Expected Following New Trade Tariffs",
    category: NewsCategory.WORLD,
    source: "Bloomberg",
    time: "6 hours ago",
  },
  {
    title: "Breakthrough in Fusion Energy Could Redefine Climate Goals",
    category: NewsCategory.SCIENCE,
    source: "BBC",
    time: "8 hours ago",
  },
  {
    title: "Cyber Warfare Command Intercepts Coordinated Attack on Grid",
    category: NewsCategory.SECURITY,
    source: "Wired",
    time: "10 hours ago",
  },
  {
    title: "New AI Regulations Proposed to Protect Enterprise Data",
    category: NewsCategory.TECHNOLOGY,
    source: "TechCrunch",
    time: "12 hours ago",
  }
];

export default function YourFeed() {
  const sections = [
    { title: 'Policy & Governance', category: NewsCategory.POLITICS, slug: 'politics' },
    { title: 'Economy & Markets', category: NewsCategory.BUSINESS, slug: 'economy' },
    { title: 'World Affairs', category: NewsCategory.WORLD, slug: 'world' },
    { title: 'Crime & Justice', category: NewsCategory.CRIME, slug: 'crime' },
    { title: 'Technology & Infrastructure', category: NewsCategory.TECHNOLOGY, slug: 'technology' },
    { title: 'Science & Environment', category: NewsCategory.SCIENCE, slug: 'science' },
    { title: 'National Security & Defense', category: NewsCategory.SECURITY, slug: 'security' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Feed</h1>
        <p className={styles.subtitle}>What important developments you need to know today.</p>
      </header>

      {/* Top Developments Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Top Developments</h2>
          <Link href="/explore" className={styles.viewAll}>View All</Link>
        </div>
        
        <div className={styles.topDevelopmentsGrid}>
          {/* Main Headline */}
          <article className={styles.mainCard}>
            <div className={styles.cardImagePlaceholder}>
              <span className={styles.categoryTag}>{topStory.category}</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardMeta}>
                <span>{topStory.time}</span>
              </div>
              <h3 className={styles.cardTitle}>{topStory.title}</h3>
              <p className={styles.cardExcerpt}>{topStory.excerpt}</p>
              <div className={styles.source}>{topStory.source}</div>
            </div>
          </article>

          {/* Side List */}
          <div className={styles.sideList}>
            {topDevelopments.map((article, index) => (
              <article key={index} className={styles.listCard}>
                <div className={styles.listCardContent}>
                  <span className={styles.listCardCategory}>{article.category}</span>
                  <h4 className={styles.listCardTitle}>{article.title}</h4>
                  <div className={styles.listCardMeta}>
                    {article.source} • {article.time}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Individual Mapped Sections for each core category */}
      {sections.map((section) => (
        <section key={section.slug} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <Link href={`/explore?category=${section.slug}`} className={styles.viewAll}>View All</Link>
          </div>
          <div className={styles.standardGrid}>
            {standardArticles.filter(a => a.category === section.category).map((article, idx) => (
              <article key={idx} className={styles.mainCard}>
                 <div className={styles.cardContent}>
                  <span className={styles.listCardCategory} style={{marginBottom: '1rem'}}>{article.category}</span>
                  <h3 className={styles.cardTitle} style={{fontSize: '1.25rem'}}>{article.title}</h3>
                  <div style={{marginTop: 'auto'}}>
                    <div className={styles.source}>{article.source}</div>
                    <div className={styles.cardMeta} style={{marginTop: '0.5rem', marginBottom: 0}}>{article.time}</div>
                  </div>
                 </div>
              </article>
            ))}
            {/* Placeholder extra article for visual balance */}
            <article className={styles.mainCard}>
               <div className={styles.cardContent}>
                <span className={styles.listCardCategory} style={{marginBottom: '1rem'}}>{section.category}</span>
                <h3 className={styles.cardTitle} style={{fontSize: '1.25rem'}}>In-Depth: The Future of {section.title} in 2026</h3>
                <div style={{marginTop: 'auto'}}>
                  <div className={styles.source}>Reuters</div>
                  <div className={styles.cardMeta} style={{marginTop: '0.5rem', marginBottom: 0}}>1 day ago</div>
                </div>
               </div>
            </article>
          </div>
        </section>
      ))}

    </div>
  );
}
