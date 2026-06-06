'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../components/YourFeed.module.css';

interface DBArticle {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  source: string;
  url: string;
  publishedAt: string;
  category: {
    id: string;
    name: string;
  };
  impactType?: 'positive' | 'negative' | 'neutral';
}

interface IntelligenceData {
  catalyst: DBArticle;
  before: DBArticle[];
  after: DBArticle[];
  summary: string;
}

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

function IntelligenceContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';

  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Please provide a valid article ID in the URL parameter (e.g. ?id=...).');
      return;
    }

    async function fetchIntelligence() {
      try {
        const response = await fetch(`http://localhost:5001/api/articles/${id}/intelligence`);
        if (!response.ok) {
          throw new Error('Failed to resolve dynamic connected intelligence logs');
        }
        const json = await response.json();
        if (json.success) {
          setData(json.data);
          setIsAiGenerated(!!json.isAiGenerated);
        } else {
          throw new Error(json.message || 'Server error resolved');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to establish connection to intelligence engine.');
      } finally {
        setLoading(false);
      }
    }

    fetchIntelligence();
  }, [id]);

  const handleTriggerAi = async () => {
    setAiGenerating(true);
    try {
      const response = await fetch(`http://localhost:5001/api/articles/${id}/intelligence?useAi=true`);
      if (!response.ok) {
        throw new Error('Failed to compile dynamic AI intelligence report');
      }
      const json = await response.json();
      if (json.success) {
        setData(json.data);
        setIsAiGenerated(!!json.isAiGenerated);
      } else {
        throw new Error(json.message || 'Failed to synthesize connections');
      }
    } catch (err: any) {
      alert(`AI Compile Exception: ${err.message}. Seamlessly keeping standard matching layout.`);
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTop: '3px solid #7c3aed',
          borderRadius: '50%',
          width: '45px',
          height: '45px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: '1.5rem', color: '#a78bfa', fontSize: '0.95rem', fontWeight: 600 }}>
          Analyzing connections & tracing cross-sector impact loops...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', marginTop: '2rem', textAlign: 'center' }}>
        <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Intelligence Sync Failed</h3>
        <p style={{ color: '#94a3b8' }}>{error || 'No records returned for this catalyst.'}</p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', textDecoration: 'none' }}>
          Back to Feed
        </Link>
      </div>
    );
  }

  const { catalyst, before, after, summary } = data;

  const positiveImpacts = after.filter(a => a.impactType === 'positive' || a.impactType === 'neutral');
  const negativeImpacts = after.filter(a => a.impactType === 'negative');

  return (
    <>
      <header className={styles.header}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 600 }}>
            ← Back to Feed
          </Link>
          <span style={{
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            borderRadius: '100px',
            color: '#c084fc',
            padding: '0.35rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            🧠 Intelligence Mode
          </span>
        </div>
        <h1 className={styles.title} style={{ fontSize: '2.25rem', lineHeight: '1.2' }}>Connected Dots & Comparative Impact</h1>
        <p className={styles.subtitle} style={{ marginTop: '0.5rem' }}>
          Tracking upstream context and cross-sector market consequences of corporate and policy actions.
        </p>
      </header>

      {/* Catalyst Decision Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.03) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.25)',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '3rem',
        position: 'relative',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{
            background: '#7c3aed',
            color: '#fff',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            Trigger Catalyst
          </span>
          <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
            {catalyst.source} • {getRelativeTime(catalyst.publishedAt)}
          </span>
        </div>
        <h2 style={{ fontSize: '1.75rem', color: '#fff', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
          {catalyst.title}
        </h2>
        <p style={{ color: '#d4d4d8', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          {catalyst.summary || 'Trigger decision representing a major structural transition in the industry.'}
        </p>
        <div style={{
          background: 'rgba(9, 9, 11, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '1.25rem',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          color: '#e4e4e7',
          borderLeft: '4px solid #a78bfa'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong>Executive Synthesis:</strong>
            {!isAiGenerated && (
              <button 
                onClick={handleTriggerAi}
                disabled={aiGenerating}
                className={styles.intelligenceBtn}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '4px', transform: 'none' }}
              >
                {aiGenerating ? '⚡️ Compiling AI...' : '⚡️ Compile Dynamic AI Intelligence'}
              </button>
            )}
            {isAiGenerated && (
              <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ✨ AI Intelligence Synthesized & Cached
              </span>
            )}
          </div>
          {summary || 'Trigger decision representing a major structural transition.'}
        </div>
      </div>

      {/* Connecting Dot Interactive Graph Visualization */}
      <section className={styles.section} style={{ marginBottom: '4rem' }}>
        <h3 className={styles.sectionTitle} style={{ color: '#c084fc', borderBottom: '1px solid rgba(167, 139, 250, 0.2)', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
          Cross-Sector Relationship Mapping
        </h3>
        
        <div style={{
          background: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '2.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '280px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <svg width="100%" height="240" viewBox="0 0 800 240" style={{ maxWidth: '650px' }}>
            <defs>
              <linearGradient id="leftGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="rightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="disruptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            <line x1="150" y1="120" x2="400" y2="120" stroke="url(#leftGrad)" strokeWidth="3" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" values="50;0" dur="4s" repeatCount="indefinite" />
            </line>
            <line x1="400" y1="120" x2="650" y2="60" stroke="url(#rightGrad)" strokeWidth="3" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" values="0;50" dur="4s" repeatCount="indefinite" />
            </line>
            <line x1="400" y1="120" x2="650" y2="180" stroke="url(#disruptGrad)" strokeWidth="3" strokeDasharray="6 4">
              <animate attributeName="stroke-dashoffset" values="0;50" dur="4s" repeatCount="indefinite" />
            </line>

            <circle cx="150" cy="120" r="28" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
            <text x="150" y="123" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">BASELINE</text>
            <text x="150" y="165" fill="#94a3b8" fontSize="11" textAnchor="middle">Old Manual Overhead</text>

            <circle cx="400" cy="120" r="42" fill="#4c1d95" stroke="#a78bfa" strokeWidth="3" />
            <circle cx="400" cy="120" r="49" fill="none" stroke="#a78bfa" strokeWidth="1" strokeOpacity="0.5">
              <animate attributeName="r" values="42;60;42" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="400" y="124" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">CATALYST</text>
            <text x="400" y="185" fill="#a78bfa" fontSize="12" fontWeight="bold" textAnchor="middle">Decision Point 🧠</text>

            <circle cx="650" cy="60" r="28" fill="#065f46" stroke="#10b981" strokeWidth="2" />
            <text x="650" y="63" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">WINNERS</text>
            <text x="650" y="105" fill="#10b981" fontSize="11" textAnchor="middle">IT & Tech Spikes 🟢</text>

            <circle cx="650" cy="180" r="28" fill="#7f1d1d" stroke="#ef4444" strokeWidth="2" />
            <text x="650" y="183" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">DISRUPT</text>
            <text x="650" y="225" fill="#f87171" fontSize="11" textAnchor="middle">Legacy Systems 🔴</text>
          </svg>
        </div>
      </section>

      {/* Tier 1: Historical Baseline Context ("Before") */}
      <section className={styles.section} style={{ marginBottom: '4rem' }}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            Step 1: Antecedent History & Baseline Context
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#71717a', fontWeight: 600 }}>The "Before" Landscape</span>
        </div>

        <div className={styles.standardGrid}>
          {before.map((art) => (
            <article key={art.id} className={styles.mainCard}>
              <div className={styles.cardContent} style={{ padding: '1.5rem' }}>
                <span className={styles.listCardCategory} style={{ color: '#3b82f6' }}>{art.category?.name}</span>
                <h4 className={styles.cardTitle} style={{ fontSize: '1.1rem', margin: '0.5rem 0 0.75rem 0' }}>{art.title}</h4>
                <p className={styles.cardExcerpt} style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
                  {art.summary || 'Historical background report detailing market structure and legacy regulations prior to the pivot.'}
                </p>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={styles.source} style={{ fontSize: '0.75rem' }}>{art.source}</span>
                  <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700 }}>
                    Details ↗
                  </a>
                </div>
              </div>
            </article>
          ))}

          {before.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '2.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px dashed #27272a',
              textAlign: 'center',
              color: '#71717a',
              fontSize: '0.9rem'
            }}>
              No historical antecedent articles detected.
            </div>
          )}
        </div>
      </section>

      {/* Tier 3: Connected Industry Impact Matrix ("After") */}
      <section className={styles.section}>
        <div className={styles.sectionHeader} style={{ marginBottom: '2rem' }}>
          <h3 className={styles.sectionTitle}>
            Step 2: Cross-Sector Impact Matrix
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#71717a', fontWeight: 600 }}>The "After" Landscape</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          
          {/* Column 1: Spikes & Benefits */}
          <div>
            <h4 style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#34d399',
              background: 'rgba(52, 211, 153, 0.1)',
              padding: '0.75rem 1.25rem',
              borderRadius: '6px',
              borderLeft: '4px solid #10b981',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>🟢</span> Benefited Industries & Market Spikes
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {positiveImpacts.map((art) => (
                <div key={art.id} style={{
                  background: 'rgba(16, 185, 129, 0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                      {art.category?.name || 'Sector Win'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#71717a' }}>{art.source}</span>
                  </div>
                  <h5 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 0.5rem 0', lineHeight: '1.3' }}>
                    {art.title}
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
                    {art.summary || 'Dynamic development reporting a spike or positive outcome linked directly.'}
                  </p>
                  <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, marginTop: 'auto', alignSelf: 'flex-end' }}>
                    Full Report ↗
                  </a>
                </div>
              ))}

              {positiveImpacts.length === 0 && (
                <div style={{
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px dashed #27272a',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#71717a',
                  fontSize: '0.85rem'
                }}>
                  Compiling positive cross-sector reports...
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Disruptions & Legacy Drag */}
          <div>
            <h4 style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#f87171',
              background: 'rgba(248, 113, 113, 0.1)',
              padding: '0.75rem 1.25rem',
              borderRadius: '6px',
              borderLeft: '4px solid #ef4444',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>🔴</span> Disrupted Sectors & Market Pressures
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {negativeImpacts.map((art) => (
                <div key={art.id} style={{
                  background: 'rgba(239, 68, 68, 0.02)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                      {art.category?.name || 'Sector Headwind'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#71717a' }}>{art.source}</span>
                  </div>
                  <h5 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 0.5rem 0', lineHeight: '1.3' }}>
                    {art.title}
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: '0 0 1rem 0', lineHeight: '1.5' }}>
                    {art.summary || 'Incident reporting compliance hurdles or legacy pressure.'}
                  </p>
                  <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ color: '#ef4444', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, marginTop: 'auto', alignSelf: 'flex-end' }}>
                    Full Report ↗
                  </a>
                </div>
              ))}

              {negativeImpacts.length === 0 && (
                <div style={{
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px dashed #27272a',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#71717a',
                  fontSize: '0.85rem'
                }}>
                  No market disruptions reported.
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}

export default function ConnectedDotsIntelligence() {
  return (
    <div className={styles.container}>
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <p style={{ color: '#a78bfa' }}>Loading Intelligence Engine...</p>
        </div>
      }>
        <IntelligenceContent />
      </Suspense>
    </div>
  );
}
