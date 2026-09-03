import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import type { ReportSummary } from '../services/api';

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <span className="chip chip-success">{score}%</span>;
  if (score >= 50) return <span className="chip chip-warning">{score}%</span>;
  return <span className="chip chip-danger">{score}%</span>;
}

function MiniBar({ pass, fail, warn, total }: { pass: number; fail: number; warn: number; total: number }) {
  if (!total) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: '2px', height: '6px', width: '80px', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface-high)' }}>
      <div style={{ flex: pass, background: 'var(--accent)' }} title={`${pass} pass`} />
      <div style={{ flex: warn, background: '#F59E0B' }} title={`${warn} warn`} />
      <div style={{ flex: fail, background: '#EF4444' }} title={`${fail} fail`} />
    </div>
  );
}

export default function AuditReports() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'fail' | 'warn'>('all');
  const LIMIT = 15;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReports(skip, LIMIT + 20); // fetch extra for filtering
      setReports(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [skip]);

  const filtered = reports.filter(r => {
    const matchSearch = !search || r.original_filename.toLowerCase().includes(search.toLowerCase()) || String(r.analysis_id).includes(search);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'pass' && r.compliance_score >= 80) ||
      (filterStatus === 'fail' && r.compliance_score < 50) ||
      (filterStatus === 'warn' && r.compliance_score >= 50 && r.compliance_score < 80);
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Compliance Records</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>Audit Reports</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '5px 0 0' }}>
            All compliance scan reports with PDF and CSV export
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => api.downloadAllCSV()} className="btn" style={{ gap: '6px', padding: '9px 16px', fontSize: '0.82rem' }}>
            <Download size={13} style={{ color: '#E3F0A3' }} /> Export All CSV
          </button>
          <button onClick={load} className="btn btn-secondary" style={{ padding: '9px 10px' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', display: 'block' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem', fontFamily: 'var(--font-body)' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename or ID…"
            className="premium-input"
            style={{ width: '100%', paddingLeft: '34px' }}
          />
        </div>
        <div className="tab-container" style={{ padding: '3px' }}>
          {(['all', 'pass', 'warn', 'fail'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`tab-button ${filterStatus === f ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              {f === 'all' ? 'All' : f === 'pass' ? '✓ Compliant' : f === 'warn' ? '⚠ Partial' : '✗ Violations'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="premium-table-container">
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block', color: 'var(--accent)' }} />
            <p style={{ margin: 0, fontSize: '0.88rem' }}>Loading reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            <FileText size={38} style={{ margin: '0 auto 14px', opacity: 0.2, display: 'block' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No reports found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  {['ID', 'Filename', 'Date', 'Score', 'Rules', 'Distribution', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, LIMIT).map((r) => (
                  <tr key={r.analysis_id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{r.analysis_id}</span></td>
                    <td style={{ maxWidth: '180px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }} title={r.original_filename}>
                        {r.original_filename}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td><ScoreBadge score={r.compliance_score} /></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.total_rules}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <MiniBar pass={r.passed} fail={r.failed} warn={r.warned} total={r.total_rules} />
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {r.passed}P / {r.failed}F / {r.warned}W
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => api.downloadPDF(r.analysis_id)} title="Download PDF Report"
                          className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem', gap: '4px' }}>
                          <Download size={11} style={{ color: 'var(--success)' }} /> PDF
                        </button>
                        <button onClick={() => api.downloadPDF(r.analysis_id, true)} title="PDF + Penalty"
                          className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem', gap: '4px', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}>
                          <Download size={11} /> +Penalty
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing {Math.min(filtered.length, LIMIT)} of {filtered.length} reports
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setSkip(Math.max(0, skip - LIMIT))} disabled={skip === 0}
            className="btn btn-secondary" style={{ padding: '7px 10px', opacity: skip === 0 ? 0.5 : 1 }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setSkip(skip + LIMIT)} disabled={reports.length < LIMIT}
            className="btn btn-secondary" style={{ padding: '7px 10px', opacity: reports.length < LIMIT ? 0.5 : 1 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
