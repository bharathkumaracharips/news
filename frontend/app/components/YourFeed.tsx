'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './YourFeed.module.css';

export enum NewsCategory {
  POLITICS = 'Politics & Governance',
  BUSINESS = 'Business & Economy',
  CRIME = 'Crime & Justice',
  WORLD = 'World Affairs',
  TECHNOLOGY = 'Technology & Infrastructure',
  SCIENCE = 'Science & Environment',
  SECURITY = 'National Security & Defense',
}

interface DBArticle {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string;
  isTopStory: boolean;
  isTopDevelopment: boolean;
  publishedAt: string;
  category: {
    id: string;
    name: string;
  };
}

// Utility to render beautiful relative timestamps
function getRelativeTime(dateStr: string): string {
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - parsed.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

export default function YourFeed() {
  const [articles, setArticles] = useState<DBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for tracking the opened article modal
  const [selectedArticle, setSelectedArticle] = useState<DBArticle | null>(null);

  const sections = [
    { title: 'Policy & Governance', category: NewsCategory.POLITICS, slug: 'politics' },
    { title: 'Economy & Markets', category: NewsCategory.BUSINESS, slug: 'economy' },
    { title: 'World Affairs', category: NewsCategory.WORLD, slug: 'world' },
    { title: 'Crime & Justice', category: NewsCategory.CRIME, slug: 'crime' },
    { title: 'Technology & Infrastructure', category: NewsCategory.TECHNOLOGY, slug: 'technology' },
    { title: 'Science & Environment', category: NewsCategory.SCIENCE, slug: 'science' },
    { title: 'National Security & Defense', category: NewsCategory.SECURITY, slug: 'security' },
  ];

  useEffect(() => {
    async function fetchLiveFeed() {
      try {
        const response = await fetch('http://localhost:5001/api/articles');
        if (!response.ok) {
          throw new Error('Server responded with an error');
        }
        const json = await response.json();
        if (json.success) {
          setArticles(json.data);
        } else {
          throw new Error(json.message || 'Failed to resolve articles');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load live news feed.');
      } finally {
        setLoading(false);
      }
    }
    fetchLiveFeed();
  }, []);

  // Filter top story: Make the absolute latest article (first in list, since sorted by date) the main highlight!
  const topStory = articles[0];
  
  // Key Developments: Make the next 3 latest articles the sidebar items!
  const topDevelopments = articles.slice(1, 4);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.95rem' }}>Syncing live news pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', marginTop: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Connection Offline</h3>
          <p style={{ color: '#94a3b8' }}>{error}</p>
          <button 
            onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Feed</h1>
        <p className={styles.subtitle}>Real-time policy, governance, and macroeconomic intelligence.</p>
      </header>

      {/* Top Story & Key Developments Grid */}
      {topStory && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Developments</h2>
            <Link href="/explore" className={styles.viewAll}>View All</Link>
          </div>
          
          <div className={styles.topDevelopmentsGrid}>
            {/* Main Headline */}
            <article className={styles.mainCard} onClick={() => setSelectedArticle(topStory)} style={{ cursor: 'pointer' }}>
              <div className={styles.cardImagePlaceholder}>
                <span className={styles.categoryTag}>{topStory.category?.name || 'Top Story'}</span>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.cardMeta}>
                  <span>{getRelativeTime(topStory.publishedAt)}</span>
                </div>
                <h3 className={styles.cardTitle}>{topStory.title}</h3>
                <p className={styles.cardExcerpt}>{topStory.summary || 'Tap to view the full report and updates.'}</p>
                <div className={styles.source}>{topStory.source}</div>
              </div>
            </article>

            {/* Side list of key developments */}
            <div className={styles.sideList}>
              {topDevelopments.map((article) => (
                <article key={article.id} className={styles.listCard} onClick={() => setSelectedArticle(article)} style={{ cursor: 'pointer' }}>
                  <div className={styles.listCardContent}>
                    <span className={styles.listCardCategory}>{article.category?.name}</span>
                    <h4 className={styles.listCardTitle}>{article.title}</h4>
                    <div className={styles.listCardMeta}>
                      {article.source} • {getRelativeTime(article.publishedAt)}
                    </div>
                  </div>
                </article>
              ))}
              {topDevelopments.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Awaiting secondary live developments...
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Individual Mapped Sections for each core category */}
      {sections.map((section) => {
        // Exclude the top story and developments from the categorized standard feed below
        const excludedIds = new Set([
          ...(topStory ? [topStory.id] : []),
          ...topDevelopments.map(d => d.id)
        ]);

        const filteredArticles = articles.filter(
          a => a.category?.name === section.category && !excludedIds.has(a.id)
        );
        
        return (
          <section key={section.slug} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <Link href={`/explore?category=${section.slug}`} className={styles.viewAll}>View All</Link>
            </div>
            
            <div className={styles.standardGrid}>
              {filteredArticles.slice(0, 2).map((article) => (
                <article key={article.id} className={styles.mainCard} onClick={() => setSelectedArticle(article)} style={{ cursor: 'pointer' }}>
                   <div className={styles.cardContent}>
                    <span className={styles.listCardCategory} style={{marginBottom: '1rem'}}>{article.category?.name}</span>
                    <h3 className={styles.cardTitle} style={{fontSize: '1.25rem'}}>{article.title}</h3>
                    <p className={styles.cardExcerpt} style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>{article.summary}</p>
                    <div style={{marginTop: 'auto'}}>
                      <div className={styles.source}>{article.source}</div>
                      <div className={styles.cardMeta} style={{marginTop: '0.5rem', marginBottom: 0}}>{getRelativeTime(article.publishedAt)}</div>
                    </div>
                   </div>
                </article>
              ))}

              {filteredArticles.length === 0 && (
                <article className={styles.mainCard}>
                   <div className={styles.cardContent}>
                    <span className={styles.listCardCategory} style={{marginBottom: '1rem'}}>{section.category}</span>
                    <h3 className={styles.cardTitle} style={{fontSize: '1.25rem', color: '#64748b'}}>Syncing fresh updates for this sector...</h3>
                    <div style={{marginTop: 'auto'}}>
                      <div className={styles.source}>System Sync</div>
                      <div className={styles.cardMeta} style={{marginTop: '0.5rem', marginBottom: 0}}>Checking feed</div>
                    </div>
                   </div>
                </article>
              )}
            </div>
          </section>
        );
      })}

      {/* Premium Glassmorphism Reader Modal */}
      {selectedArticle && (
        <div className={styles.modalOverlay} onClick={() => setSelectedArticle(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalInner}>
              <div className={styles.modalMeta}>
                <span className={styles.modalCategory}>{selectedArticle.category?.name || 'In Depth'}</span>
                <span>{getRelativeTime(selectedArticle.publishedAt)}</span>
              </div>
              
              <h2 className={styles.modalTitle}>{selectedArticle.title}</h2>
              
              {selectedArticle.summary && (
                <div className={styles.modalSummary}>
                  <strong>Brief:</strong> {selectedArticle.summary}
                </div>
              )}
              
              <div className={styles.modalBody}>
                {selectedArticle.content || 'Tap visiting source button below to read full documentation and insights.'}
              </div>
              
              <div className={styles.modalFooter}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Publisher</span>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedArticle.source}</strong>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className={styles.closeBtn} onClick={() => setSelectedArticle(null)}>
                    Close Reader
                  </button>
                  <a 
                    href={selectedArticle.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.visitSourceBtn}
                  >
                    Visit Source ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
