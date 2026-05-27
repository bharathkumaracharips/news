'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../components/YourFeed.module.css';

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

// Map slugs to display names
const SLUG_TO_CATEGORY: Record<string, string> = {
  politics: NewsCategory.POLITICS,
  economy: NewsCategory.BUSINESS,
  world: NewsCategory.WORLD,
  crime: NewsCategory.CRIME,
  technology: NewsCategory.TECHNOLOGY,
  science: NewsCategory.SCIENCE,
  security: NewsCategory.SECURITY,
};

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

function ExploreFeedContent() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category') || '';
  
  const categoryName = SLUG_TO_CATEGORY[categorySlug.toLowerCase()] || '';

  const [articles, setArticles] = useState<DBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<DBArticle | null>(null);

  useEffect(() => {
    async function fetchCategoryArticles() {
      setLoading(true);
      try {
        // Query PostgreSQL backend using standard category query selectors
        const url = categoryName 
          ? `http://localhost:5001/api/articles?category=${encodeURIComponent(categoryName)}`
          : 'http://localhost:5001/api/articles';

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to resolve category news articles');
        }
        const json = await response.json();
        if (json.success) {
          setArticles(json.data);
        } else {
          throw new Error(json.message || 'Server error occurred');
        }
      } catch (err: any) {
        setError(err.message || 'Offline or Server Unavailable');
      } finally {
        setLoading(false);
      }
    }

    fetchCategoryArticles();
  }, [categorySlug, categoryName]);

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <>
      <header className={styles.header}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 600 }}>
            ← Back to Feed
          </Link>
        </div>
        <h1 className={styles.title}>{categoryName || 'Explore Categories'}</h1>
        <p className={styles.subtitle}>
          {articles.length} active global intelligence logs mapped inside this sector.
        </p>
      </header>

      {articles.length === 0 ? (
        <div style={{ padding: '4rem 2rem', background: '#18181b', borderRadius: '8px', border: '1px solid #27272a', textAlign: 'center', color: '#94a3b8' }}>
          <h3>Awaiting Live Releases</h3>
          <p style={{ marginTop: '0.5rem' }}>The background crawler will sync live articles inside this sector shortly.</p>
        </div>
      ) : (
        <div className={styles.standardGrid}>
          {articles.map((article) => (
            <article key={article.id} className={styles.mainCard} onClick={() => setSelectedArticle(article)} style={{ cursor: 'pointer' }}>
               <div className={styles.cardContent}>
                <span className={styles.listCardCategory} style={{ marginBottom: '1rem' }}>{article.category?.name}</span>
                <h3 className={styles.cardTitle} style={{ fontSize: '1.25rem' }}>{article.title}</h3>
                <p className={styles.cardExcerpt} style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {article.summary || 'Tap to view the full details.'}
                </p>
                <div style={{ marginTop: 'auto' }}>
                  <div className={styles.source}>{article.source}</div>
                  <div className={styles.cardMeta} style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    {getRelativeTime(article.publishedAt)}
                  </div>
                </div>
               </div>
            </article>
          ))}
        </div>
      )}

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
                {selectedArticle.content || 'Tap visiting source button below to read full documentation.'}
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
    </>
  );
}

export default function ExploreFeed() {
  return (
    <div className={styles.container}>
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <p style={{ color: '#94a3b8' }}>Loading Explorer...</p>
        </div>
      }>
        <ExploreFeedContent />
      </Suspense>
    </div>
  );
}
