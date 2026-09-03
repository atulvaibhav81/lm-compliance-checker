/* ─── Single Scan Page wrapper ─────────────────────────────────────────── */
import React, { useState } from 'react';
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
    <div className="flex flex-col gap-5 page-enter w-full max-w-4xl mx-auto">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold m-0 tracking-tight text-[var(--text-primary)]">Single Scan</h1>
        <p className="font-[family-name:var(--font-body)] text-[var(--text-muted)] text-sm mt-1 mb-0">
          Upload one label image for instant compliance analysis
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[var(--danger-bg)] text-[var(--danger)] rounded-xl border border-[var(--danger-border)] text-sm font-[family-name:var(--font-body)]">
          {error}
        </div>
      )}

      {!currentAnalysis && <UploadPanel onScan={handleScan} isScanning={isScanning} />}

      {currentAnalysis && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2 className="font-[family-name:var(--font-body)] text-xl font-bold m-0 text-[var(--text-primary)]">Analysis Results</h2>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-secondary px-3 py-1.5 text-xs sm:text-sm font-semibold text-[var(--accent-primary)] gap-1.5"
                onClick={() => api.downloadPDF(currentAnalysis.analysis_id)}
              >
                ↓ Download PDF
              </button>
              <button
                className="btn px-3 py-1.5 text-xs sm:text-sm"
                onClick={() => setCurrentAnalysis(null)}
              >
                New Scan
              </button>
            </div>
          </div>
          <AnalysisPanel analysis={currentAnalysis} />
        </div>
      )}
    </div>
  );
}
