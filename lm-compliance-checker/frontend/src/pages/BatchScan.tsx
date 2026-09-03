import React, { useCallback, useState } from 'react';
import { Upload, X, Layers, Play, Download, FileImage } from 'lucide-react';
import { api } from '../services/api';
import type { BatchJob, BatchItem } from '../services/api';

const MAX_FILES = 20;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    done:       { color: 'text-[#22C55E]', bg: 'bg-[rgba(34,197,94,0.12)]',  label: 'Done' },
    pending:    { color: 'text-[#94A3B8]', bg: 'bg-[rgba(148,163,184,0.12)]', label: 'Pending' },
    processing: { color: 'text-[#3B82F6]', bg: 'bg-[rgba(59,130,246,0.12)]', label: 'Processing' },
    error:      { color: 'text-[#EF4444]', bg: 'bg-[rgba(239,68,68,0.12)]',  label: 'Error' },
  };
  const s = map[status] || map['pending'];
  return (
    <span className={`text-[10px] font-bold ${s.color} ${s.bg} px-2 py-0.5 rounded-full uppercase tracking-wider`}>
      {s.label}
    </span>
  );
}

export default function BatchScan() {
  const [files, setFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<'select' | 'uploading' | 'processing' | 'done'>('select');
  const [batchResult, setBatchResult] = useState<BatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setFiles(prev => {
      const combined = [...prev, ...arr];
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files. Trimmed to first ${MAX_FILES}.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  const runBatch = async () => {
    if (!files.length) return;
    setError(null);
    try {
      setStage('uploading');
      const { batch_id } = await api.uploadBatch(files, batchName || undefined);
      
      setStage('processing');
      // Kick off processing
      let result = await api.processBatch(batch_id);
      setBatchResult(result);
      
      // Poll until done
      while (result.status === 'pending' || result.status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, 3000));
        result = await api.getBatch(batch_id);
        setBatchResult(result);
      }
      
      setStage('done');
    } catch (e: any) {
      setError(e.message || 'Batch failed');
      setStage('select');
    }
  };

  const reset = () => { setFiles([]); setBatchResult(null); setStage('select'); setError(null); setBatchName(''); };

  const scoreColor = (s: number | null) =>
    s === null ? 'text-[#94A3B8]' : s >= 80 ? 'text-[#22C55E]' : s >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]';

  return (
    <div className="flex flex-col gap-5 page-enter w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="section-label mb-1.5">Bulk Label Analysis</div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-[1.7rem] font-bold tracking-tight text-[var(--text-primary)] m-0">Batch Scan</h1>
          <p className="font-[family-name:var(--font-body)] text-[var(--text-muted)] text-sm mt-1 mb-0">
            Upload up to {MAX_FILES} label images for bulk compliance analysis
          </p>
        </div>
        {stage === 'done' && batchResult && (
          <button onClick={() => api.downloadBatchCSV(batchResult.batch_id)} className="btn w-full sm:w-auto justify-center px-4 py-2.5 text-sm gap-2">
            <Download size={15} /> Download CSV
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-[var(--radius-md)] text-[var(--danger)] text-sm font-[family-name:var(--font-body)]">
          {error}
        </div>
      )}

      {stage === 'select' && (
        <>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('batch-file-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-[var(--accent-primary)] bg-[rgba(99,102,241,0.06)]' : 'border-[var(--border)] bg-[var(--surface-low)]'}`}
          >
            <input
              id="batch-file-input"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
            <Layers size={40} className={`mx-auto mb-3 ${isDragging ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
            <p className={`font-semibold m-0 mb-1.5 ${isDragging ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
              {isDragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
            </p>
            <p className="text-[var(--text-muted)] text-xs m-0">
              JPEG, PNG, WebP, BMP — max {MAX_FILES} files, 10MB each
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden w-full">
              <div className="p-3.5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-high)]">
                <span className="font-semibold text-[0.9rem] flex flex-wrap items-center gap-1.5">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                  <span className="text-[var(--text-muted)] font-normal text-[0.8rem]">
                    ({(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </span>
                <button onClick={() => setFiles([])} className="bg-transparent border-none text-[var(--text-muted)] cursor-pointer text-xs font-semibold hover:text-[var(--text-primary)]">
                  Clear all
                </button>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-low)]">
                    <FileImage size={16} className="text-[var(--accent)] shrink-0" />
                    <span className="flex-1 text-sm text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</span>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1 flex hover:text-[var(--danger)]">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Batch name + Run */}
              <div className="p-3.5 flex flex-col sm:flex-row gap-3 items-center bg-[var(--surface-low)] border-t border-[var(--border)]">
                <input
                  type="text"
                  placeholder="Batch name (optional)"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  className="premium-input w-full flex-1"
                />
                <button
                  onClick={runBatch}
                  className="btn w-full sm:w-auto justify-center px-6 py-2.5"
                >
                  <Play size={14} className="text-[#E3F0A3]" /> Run Batch
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Processing progress */}
      {(stage === 'uploading' || stage === 'processing') && (
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-[var(--accent)] animate-spin mx-auto mb-4" />
          <p className="font-bold m-0 mb-1.5 text-[var(--text-primary)]">
            {stage === 'uploading' ? 'Uploading images…' : 'Running compliance analysis…'}
          </p>
          <p className="text-[var(--text-muted)] text-sm m-0">
            {stage === 'processing' ? `Scanning ${files.length} images through OCR + rule engine` : 'Saving files to server'}
          </p>
        </div>
      )}

      {/* Results */}
      {stage === 'done' && batchResult && (
        <div className="flex flex-col gap-4 w-full">
          {/* Summary banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: batchResult.total_images, color: 'text-[#3B82F6]' },
              { label: 'Processed', value: batchResult.processed_images, color: 'text-[#22C55E]' },
              { label: 'Failed', value: batchResult.failed_images, color: 'text-[#EF4444]' },
              { label: 'Avg Score', value: `${batchResult.avg_compliance_score ?? 0}%`, color: 'text-[#6366F1]' },
            ].map((c, i) => (
              <div key={i} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-1)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">{c.label}</div>
                <div className={`text-2xl font-bold font-[family-name:var(--font-display)] ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden w-full">
            <div className="p-3.5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-high)]">
              <span className="font-bold text-[0.95rem] text-[var(--text-primary)]">Scan Results</span>
              <button onClick={reset} className="btn btn-secondary px-3 py-1.5 text-xs">
                New Batch
              </button>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="premium-table min-w-[700px]">
                <thead>
                  <tr>
                    {['#', 'Filename', 'Status', 'Score', 'Pass', 'Fail', 'Warn', 'Actions'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batchResult.items.map((item, i) => (
                    <tr key={item.item_id}>
                      <td className="text-[var(--text-muted)] font-mono text-xs">{i + 1}</td>
                      <td className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[var(--text-primary)]">{item.filename}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className={`font-bold ${scoreColor(item.compliance_score)}`}>
                        {item.compliance_score !== null ? `${item.compliance_score}%` : '—'}
                      </td>
                      <td className="text-[#22C55E] font-medium">{item.pass_count ?? '—'}</td>
                      <td className="text-[#EF4444] font-medium">{item.fail_count ?? '—'}</td>
                      <td className="text-[#F59E0B] font-medium">{item.warn_count ?? '—'}</td>
                      <td>
                        {item.analysis_id && (
                          <button
                            onClick={() => api.downloadPDF(item.analysis_id!)}
                            className="btn btn-secondary px-2 py-1 text-[0.7rem] gap-1"
                          >
                            <Download size={11} /> PDF
                          </button>
                        )}
                        {item.error_message && (
                          <span className="text-[0.72rem] text-[var(--danger)] block mt-1 leading-tight">{item.error_message.slice(0, 40)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
