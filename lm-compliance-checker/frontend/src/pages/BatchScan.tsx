import React, { useCallback, useState } from 'react';
import { Upload, X, Layers, Play, Download, CheckCircle, XCircle, AlertTriangle, Clock, FileImage } from 'lucide-react';
import { api } from '../services/api';
import type { BatchJob, BatchItem } from '../services/api';

const MAX_FILES = 20;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    done:       { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  label: 'Done' },
    pending:    { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', label: 'Pending' },
    processing: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Processing' },
    error:      { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Error' },
  };
  const s = map[status] || map['pending'];
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: '12px' }}>
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
    s === null ? '#94A3B8' : s >= 80 ? '#22C55E' : s >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Bulk Label Analysis</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>Batch Scan</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '5px 0 0' }}>
            Upload up to {MAX_FILES} label images for bulk compliance analysis
          </p>
        </div>
        {stage === 'done' && batchResult && (
          <button onClick={() => api.downloadBatchCSV(batchResult.batch_id)} className="btn" style={{ gap: '6px', padding: '9px 16px', fontSize: '0.85rem' }}>
            <Download size={15} /> Download CSV
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem' }}>
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
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '48px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)',
              transition: 'all 0.2s',
            }}
          >
            <input
              id="batch-file-input"
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
            <Layers size={40} color={isDragging ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
            <p style={{ color: isDragging ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, margin: '0 0 6px' }}>
              {isDragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
              JPEG, PNG, WebP, BMP — max {MAX_FILES} files, 10MB each
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem', marginLeft: '8px' }}>
                    ({(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB total)
                  </span>
                </span>
                <button onClick={() => setFiles([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  Clear all
                </button>
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                    <FileImage size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.83rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Batch name + Run */}
              <div style={{ padding: '14px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Batch name (optional)"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  style={{
                    flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={runBatch}
                  style={{
                    background: 'var(--accent-primary)', border: 'none', color: '#fff',
                    borderRadius: '8px', padding: '8px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Play size={14} /> Run Batch
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Processing progress */}
      {(stage === 'uploading' || stage === 'processing') && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>
            {stage === 'uploading' ? 'Uploading images…' : 'Running compliance analysis…'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', margin: 0 }}>
            {stage === 'processing' ? `Scanning ${files.length} images through OCR + rule engine` : 'Saving files to server'}
          </p>
        </div>
      )}

      {/* Results */}
      {stage === 'done' && batchResult && (
        <>
          {/* Summary banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Total', value: batchResult.total_images, color: '#3B82F6' },
              { label: 'Processed', value: batchResult.processed_images, color: '#22C55E' },
              { label: 'Failed', value: batchResult.failed_images, color: '#EF4444' },
              { label: 'Avg Score', value: `${batchResult.avg_compliance_score ?? 0}%`, color: '#6366F1' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Scan Results</span>
              <button onClick={reset} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                New Batch
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    {['#', 'Filename', 'Status', 'Score', 'Pass', 'Fail', 'Warn', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batchResult.items.map((item, i) => (
                    <tr key={item.item_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={item.status} /></td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: scoreColor(item.compliance_score) }}>
                        {item.compliance_score !== null ? `${item.compliance_score}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#22C55E' }}>{item.pass_count ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#EF4444' }}>{item.fail_count ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#F59E0B' }}>{item.warn_count ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {item.analysis_id && (
                          <button
                            onClick={() => api.downloadPDF(item.analysis_id!)}
                            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={11} /> PDF
                          </button>
                        )}
                        {item.error_message && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{item.error_message.slice(0, 40)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
