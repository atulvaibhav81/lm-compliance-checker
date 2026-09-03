import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import type { PenaltyResult, PenaltyMatrixEntry, ReportSummary } from '../services/api';

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

export default function PenaltyCalculator() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [matrix, setMatrix] = useState<PenaltyMatrixEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [isRepeat, setIsRepeat] = useState(false);
  const [result, setResult] = useState<PenaltyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    api.getReports(0, 50).then(setReports).catch(() => {});
  }, []);

  const loadMatrix = async () => {
    if (matrix.length) { setShowMatrix(v => !v); return; }
    setLoadingMatrix(true);
    try {
      const m = await api.getPenaltyMatrix();
      setMatrix(m);
      setShowMatrix(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const calculate = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.calculatePenalty(Number(selectedId), isRepeat);
      setResult(r);
    } catch (e: any) {
      setError(e.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Fine Estimation Engine</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>Penalty Calculator</h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '5px 0 0' }}>
            Maps violations to Legal Metrology Act 2009 sections with estimated fine ranges
          </p>
        </div>
        <button onClick={loadMatrix} className="btn btn-secondary" style={{ gap: '7px', padding: '9px 16px', fontSize: '0.82rem' }}>
          <BookOpen size={13} />
          {showMatrix ? 'Hide' : 'View'} Penalty Matrix
          {loadingMatrix && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem', fontFamily: 'var(--font-body)' }}>
          {error}
        </div>
      )}

      {showMatrix && matrix.length > 0 && (
        <div className="premium-table-container">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-high)' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>LM-PC Penalty Matrix</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="premium-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  {['Rule Code', 'Description', 'Act Section', '1st Offense', 'Repeat Offense', 'Notes'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((entry, i) => (
                  <tr key={i}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 700 }}>{entry.rule_code}</span></td>
                    <td>{entry.description}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{entry.act_section}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(entry.first_offense_min)} – {fmt(entry.first_offense_max)}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(entry.repeat_offense_min)} – {fmt(entry.repeat_offense_max)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{entry.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calculator card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: '0 0 18px' }}>Calculate Penalties</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
          <div>
            <label className="form-label">Select Analysis Report *</label>
            <select
              value={selectedId}
              onChange={e => { setSelectedId(Number(e.target.value)); setResult(null); }}
              className="premium-input"
              style={{ width: '100%' }}
            >
              <option value="">-- Choose a report --</option>
              {reports.map(r => (
                <option key={r.analysis_id} value={r.analysis_id}>
                  #{r.analysis_id} — {r.original_filename} ({r.failed} violations, score {r.compliance_score}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Offense Type</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[false, true].map(val => (
                <button
                  key={String(val)}
                  onClick={() => setIsRepeat(val)}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    border: `2px solid ${isRepeat === val ? (val ? 'var(--danger)' : 'var(--accent)') : 'var(--border)'}`,
                    background: isRepeat === val ? (val ? 'var(--danger-bg)' : 'var(--success-bg)') : 'var(--surface-card)',
                    color: isRepeat === val ? (val ? 'var(--danger)' : 'var(--success)') : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {val ? '⚠ Repeat Offense' : '✓ First Offense'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={calculate}
          disabled={!selectedId || loading}
          className="btn"
          style={{ padding: '11px 24px', fontSize: '0.9rem', gap: '8px' }}
        >
          {loading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <DollarSign size={15} style={{ color: '#E3F0A3' }} />}
          {loading ? 'Calculating…' : 'Calculate Penalty'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary banner */}
          <div style={{
            background: result.violation_count === 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${result.violation_count === 0 ? 'var(--success-border)' : 'var(--danger-border)'}`,
            borderRadius: 'var(--radius-lg)', padding: '22px 26px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="section-label" style={{ marginBottom: '4px' }}>
                  {result.is_repeat_offense ? 'Repeat Offense' : 'First Offense'} — Analysis #{result.analysis_id}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: result.violation_count === 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {result.violation_count === 0 ? 'No Penalty Applicable' : `${fmt(result.total_fine_min)} – ${fmt(result.total_fine_max)}`}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '5px' }}>{result.applicable_act}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 700, color: result.violation_count > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {result.violation_count}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>violation{result.violation_count !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', margin: '12px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{result.summary_text}</p>
          </div>

          {/* Violations breakdown */}
          {result.violations.length > 0 && (
            <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-high)' }}>
                <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Violation Breakdown</h3>
              </div>
              {result.violations.map((v, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <AlertTriangle size={15} color="#EF4444" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{v.rule_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.rule_code}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '0.9rem' }}>
                        {fmt(v.fine_min)} – {fmt(v.fine_max)}
                      </span>
                      {expandedIdx === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {expandedIdx === i && (
                    <div style={{ padding: '0 16px 14px 44px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Description:</strong> {v.description}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}><strong>Act Section:</strong> {v.act_section}</div>
                      {v.notes && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}><strong>Notes:</strong> {v.notes}</div>
                      )}
                      {v.imprisonment_months > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#EF4444' }}><strong>Imprisonment:</strong> Up to {v.imprisonment_months} months</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
