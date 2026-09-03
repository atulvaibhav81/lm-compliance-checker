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
    <div className="flex flex-col gap-5 page-enter w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="section-label mb-1.5">Fine Estimation Engine</div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-[1.7rem] font-bold tracking-tight text-[var(--text-primary)] m-0">Penalty Calculator</h1>
          <p className="font-[family-name:var(--font-body)] text-[var(--text-muted)] text-sm mt-1 mb-0">
            Maps violations to Legal Metrology Act 2009 sections with estimated fine ranges
          </p>
        </div>
        <button onClick={loadMatrix} className="btn btn-secondary w-full sm:w-auto justify-center px-4 py-2 text-sm gap-2">
          <BookOpen size={14} />
          {showMatrix ? 'Hide' : 'View'} Penalty Matrix
          {loadingMatrix && <RefreshCw size={12} className="animate-spin" />}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-[var(--radius-md)] text-[var(--danger)] text-sm font-[family-name:var(--font-body)]">
          {error}
        </div>
      )}

      {showMatrix && matrix.length > 0 && (
        <div className="premium-table-container w-full overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-high)]">
            <h3 className="font-[family-name:var(--font-body)] font-bold text-sm text-[var(--text-primary)] m-0">LM-PC Penalty Matrix</h3>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="premium-table min-w-[700px] text-xs">
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
                    <td><span className="font-[family-name:var(--font-mono)] text-[var(--success)] font-bold">{entry.rule_code}</span></td>
                    <td className="whitespace-normal min-w-[200px]">{entry.description}</td>
                    <td className="text-[var(--text-muted)]">{entry.act_section}</td>
                    <td className="text-[var(--success)] font-semibold whitespace-nowrap">{fmt(entry.first_offense_min)} – {fmt(entry.first_offense_max)}</td>
                    <td className="text-[var(--danger)] font-semibold whitespace-nowrap">{fmt(entry.repeat_offense_min)} – {fmt(entry.repeat_offense_max)}</td>
                    <td className="text-[var(--text-muted)] max-w-[200px] truncate" title={entry.notes || ''}>{entry.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calculator card */}
      <div className="glass-card p-5 sm:p-6 w-full">
        <h3 className="font-[family-name:var(--font-body)] font-bold text-base text-[var(--text-primary)] tracking-tight m-0 mb-4">Calculate Penalties</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="form-label">Select Analysis Report *</label>
            <select
              value={selectedId}
              onChange={e => { setSelectedId(Number(e.target.value)); setResult(null); }}
              className="premium-input w-full"
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
            <div className="flex flex-col sm:flex-row gap-2.5">
              {[false, true].map(val => (
                <button
                  key={String(val)}
                  onClick={() => setIsRepeat(val)}
                  className={`flex-1 px-3 py-2.5 rounded-[var(--radius)] text-sm font-bold cursor-pointer font-[family-name:var(--font-body)] border-2 transition-all duration-150 ${
                    isRepeat === val 
                      ? (val ? 'border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]' : 'border-[var(--accent)] bg-[var(--success-bg)] text-[var(--success)]') 
                      : 'border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                  }`}
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
          className="btn w-full sm:w-auto justify-center px-6 py-2.5 text-sm gap-2"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <DollarSign size={15} className="text-[#E3F0A3]" />}
          {loading ? 'Calculating…' : 'Calculate Penalty'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-4 w-full">
          {/* Summary banner */}
          <div className={`rounded-[var(--radius-lg)] p-5 sm:p-6 border ${result.violation_count === 0 ? 'bg-[var(--success-bg)] border-[var(--success-border)]' : 'bg-[var(--danger-bg)] border-[var(--danger-border)]'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="section-label mb-1">
                  {result.is_repeat_offense ? 'Repeat Offense' : 'First Offense'} — Analysis #{result.analysis_id}
                </div>
                <div className={`font-[family-name:var(--font-display)] text-[1.4rem] sm:text-[1.6rem] font-bold ${result.violation_count === 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {result.violation_count === 0 ? 'No Penalty Applicable' : `${fmt(result.total_fine_min)} – ${fmt(result.total_fine_max)}`}
                </div>
                <div className="font-[family-name:var(--font-body)] text-xs sm:text-sm text-[var(--text-muted)] mt-1.5">{result.applicable_act}</div>
              </div>
              <div className="text-left sm:text-right mt-2 sm:mt-0">
                <div className={`font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold ${result.violation_count > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                  {result.violation_count}
                </div>
                <div className="font-[family-name:var(--font-body)] text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase">violation{result.violation_count !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <p className="font-[family-name:var(--font-body)] mt-3 text-[0.84rem] text-[var(--text-secondary)] m-0">{result.summary_text}</p>
          </div>

          {/* Violations breakdown */}
          {result.violations.length > 0 && (
            <div className="glass-card overflow-hidden w-full overflow-x-auto">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-high)] min-w-[300px]">
                <h3 className="font-[family-name:var(--font-body)] font-bold text-sm text-[var(--text-primary)] m-0">Violation Breakdown</h3>
              </div>
              <div className="min-w-[300px]">
                {result.violations.map((v, i) => (
                  <div key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                      className="w-full bg-transparent border-none cursor-pointer px-4 py-3.5 flex justify-between items-center text-left hover:bg-[var(--surface-low)] transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 pr-4">
                        <AlertTriangle size={16} className="text-[#EF4444] shrink-0 mt-0.5 sm:mt-0" />
                        <div>
                          <div className="font-semibold text-sm text-[var(--text-primary)]">{v.rule_name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{v.rule_code}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-[#EF4444] text-sm whitespace-nowrap">
                          {fmt(v.fine_min)} – {fmt(v.fine_max)}
                        </span>
                        <div className="text-[var(--text-muted)]">
                          {expandedIdx === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </button>
                    {expandedIdx === i && (
                      <div className="px-4 py-3 pl-11 flex flex-col gap-1.5 bg-[var(--surface-dim)]">
                        <div className="text-xs text-[var(--text-secondary)]"><strong>Description:</strong> {v.description}</div>
                        <div className="text-xs text-[var(--accent-primary)]"><strong>Act Section:</strong> {v.act_section}</div>
                        {v.notes && (
                          <div className="text-xs text-[var(--warning)]"><strong>Notes:</strong> {v.notes}</div>
                        )}
                        {v.imprisonment_months > 0 && (
                          <div className="text-xs text-[#EF4444]"><strong>Imprisonment:</strong> Up to {v.imprisonment_months} months</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
