/* ─── Single Scan Page wrapper ─────────────────────────────────────────── */
import React, { useState, useEffect } from 'react';
import { UploadPanel } from '../components/UploadPanel';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';

export default function SingleScan() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (file: File) => {
    setIsScanning(true);
    setError(null);
    try {
      const uploadRes = await api.uploadImage(file);
      const analysisRes = await api.analyzeUpload(uploadRes.upload_id);
      setCurrentAnalysis(analysisRes);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Single Scan</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
          Upload one label image for instant compliance analysis
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', borderRadius: '8px', border: '1px solid var(--danger)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {!currentAnalysis && <UploadPanel onScan={handleScan} isScanning={isScanning} />}

      {currentAnalysis && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Analysis Results</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => api.downloadPDF(currentAnalysis.analysis_id)}
                style={{
                  padding: '7px 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                  color: 'var(--accent-primary)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.83rem',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                ↓ Download PDF
              </button>
              <button
                className="btn"
                style={{ padding: '7px 14px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                onClick={() => setCurrentAnalysis(null)}
              >
                New Scan
              </button>
            </div>
          </div>
          <AnalysisPanel analysis={currentAnalysis} />
        </>
      )}
    </div>
  );
}
