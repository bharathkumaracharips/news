'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../../components/YourFeed.module.css';

interface ReportCategory {
  category: string;
  papersCovering: string[];
  synthesis: string;
  articles: {
    newspaper: string;
    title: string;
    contentPreview: string;
  }[];
}

interface ReportData {
  date: string;
  papersAnalyzed: string[];
  report: ReportCategory[];
}

function ReportContent() {
  const searchParams = useSearchParams();
  const dateQuery = searchParams.get('date');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!dateQuery) {
        setError('No date selected.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`http://localhost:5001/api/newspapers/report?date=${dateQuery}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || 'Failed to fetch report');
        }
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [dateQuery]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTop: '3px solid #10b981',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: '1.5rem', color: '#94a3b8' }}>Synthesizing comparative AI Newspaper...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', marginTop: '2rem', textAlign: 'center' }}>
        <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Report Generation Failed</h3>
        <p style={{ color: '#94a3b8' }}>{error}</p>
        <Link href="/newspaper" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', textDecoration: 'none' }}>
          Back to Analysis Wing
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      
      <div style={{ padding: '2.5rem', background: 'linear-gradient(to bottom right, #18181b, #09090b)', borderRadius: '16px', border: '1px solid #27272a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              Final AI Newspaper
            </h1>
            <p style={{ color: '#10b981', fontSize: '1.1rem', margin: 0, fontWeight: 500 }}>
              Synthesized Date: {new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link href="/newspaper" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Upload more
          </Link>
        </div>

        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 1rem', borderRadius: '20px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
            {data.papersAnalyzed.length} Publishers Analyzed
          </div>
          {data.papersAnalyzed.map(p => (
             <div key={p} style={{ background: '#27272a', border: '1px solid #3f3f46', padding: '0.5rem 1rem', borderRadius: '20px', color: '#d4d4d8', fontSize: '0.85rem' }}>
               {p}
             </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {data.report.map((cat, idx) => (
          <div key={idx} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>Sector: {cat.category}</h3>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 {cat.papersCovering.map(p => (
                   <span key={p} style={{ background: '#3b82f6', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{p}</span>
                 ))}
               </div>
            </div>

            {/* AI Synthesis */}
            <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.02)', borderBottom: '1px dashed #27272a' }}>
              <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>✨ AI Cross-Reference Insight</div>
              <p style={{ color: '#d4d4d8', margin: 0, lineHeight: '1.6' }}>{cat.synthesis}</p>
            </div>

            {/* Component Articles */}
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {cat.articles.map((art, aIdx) => (
                <div key={aIdx} style={{ background: '#09090b', padding: '1.25rem', borderRadius: '8px', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Reported by: <span style={{ color: '#fff', fontWeight: 600 }}>{art.newspaper}</span></div>
                  <h4 style={{ color: '#fff', fontSize: '1rem', margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>{art.title}</h4>
                  <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>{art.contentPreview}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default function ReportPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div style={{ color: '#fff' }}>Loading report context...</div>}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
