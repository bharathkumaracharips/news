'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../components/YourFeed.module.css';

export default function NewspaperUploadPage() {
  const router = useRouter();
  const [newspaperName, setNewspaperName] = useState('');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newspaperName || !publishDate || !file) {
      setError('Please fill in all fields and select a PDF.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('name', newspaperName);
    formData.append('publishDate', publishDate);
    formData.append('pdf', file);

    try {
      const res = await fetch('http://localhost:5001/api/newspapers/upload', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to process newspaper');
      }

      setSuccessMsg(`Successfully extracted ${json.data.articles.length} simulated articles from ${newspaperName}.`);
      setNewspaperName('');
      setFile(null);
      // Reset file input UI manually if needed, but react handles it if controlled.
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Newspaper Analysis Wing</h1>
        <p className={styles.subtitle}>Upload daily newspaper PDFs for AI aggregation and dot-connecting.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Upload Form */}
        <section style={{ padding: '2rem', background: '#18181b', borderRadius: '12px', border: '1px solid #27272a' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#fff' }}>Upload Digital Edition</h2>
          
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
          {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{successMsg}</div>}
          
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Newspaper Name (e.g. The Hindu, Times of India)</label>
              <input 
                type="text" 
                value={newspaperName} 
                onChange={(e) => setNewspaperName(e.target.value)} 
                style={{ background: '#09090b', border: '1px solid #3f3f46', color: '#fff', padding: '0.75rem', borderRadius: '6px' }} 
                placeholder="Enter newspaper name..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Publish Date</label>
              <input 
                type="date" 
                value={publishDate} 
                onChange={(e) => setPublishDate(e.target.value)} 
                style={{ background: '#09090b', border: '1px solid #3f3f46', color: '#fff', padding: '0.75rem', borderRadius: '6px', colorScheme: 'dark' }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Upload PDF</label>
              <input 
                type="file" 
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ background: '#09090b', border: '1px dashed #3f3f46', color: '#a1a1aa', padding: '1rem', borderRadius: '6px', cursor: 'pointer' }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ background: loading ? '#2563eb80' : '#2563eb', color: '#fff', padding: '1rem', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '1rem' }}
            >
              {loading ? 'AI Parsing Document...' : 'Upload & Parse PDF'}
            </button>
          </form>
        </section>

        {/* Generate Report UI */}
        <section style={{ padding: '2rem', background: '#18181b', borderRadius: '12px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: '#fff' }}>Run AI Aggregation</h2>
          <p style={{ color: '#a1a1aa', lineHeight: '1.6', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Once you have uploaded the PDFs for a specific date, you can run the AI aggregation engine. The AI will cross-reference reports from different publishers, map overlapping stories into sectors, and highlight the varying impact projections.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
              <label style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Target Date to Compile</label>
              <input 
                type="date" 
                id="reportDate"
                defaultValue={new Date().toISOString().split('T')[0]}
                style={{ background: '#09090b', border: '1px solid #3f3f46', color: '#fff', padding: '0.75rem', borderRadius: '6px', colorScheme: 'dark', marginBottom: '1rem' }} 
              />
              <button 
                onClick={() => {
                  const date = (document.getElementById('reportDate') as HTMLInputElement).value;
                  router.push(`/newspaper/report?date=${date}`);
                }}
                style={{ background: '#10b981', color: '#fff', padding: '1rem', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Generate Final AI Newspaper ↗
              </button>
            </div>
        </section>

      </div>
    </div>
  );
}
