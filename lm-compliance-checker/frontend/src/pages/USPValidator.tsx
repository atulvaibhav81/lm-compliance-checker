import React, { useState } from 'react';
import { Tag, Calculator, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { api } from '../services/api';
import type { USPValidationResult } from '../services/api';

const UNITS = ['g', 'gm', 'kg', 'ml', 'l', 'nos', 'pcs'];

function StatusIcon({ status }: { status: string }) {
  if (status === 'PASS') return <CheckCircle size={20} color="#22C55E" />;
  if (status === 'FAIL') return <XCircle size={20} color="#EF4444" />;
  if (status === 'WARN') return <AlertTriangle size={20} color="#F59E0B" />;
  return <Info size={20} color="#94A3B8" />;
}

function ResultRow({ label, value, highlight }: { label: string; value: string | number | null; highlight?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: highlight || 'var(--text-primary)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function USPValidator() {
  const [mrp, setMrp] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('g');
  const [printedUsp, setPrintedUsp] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [mode, setMode] = useState<'manual' | 'ocr'>('manual');
  const [result, setResult] = useState<USPValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (mode === 'manual') {
        if (!mrp || !qty) throw new Error('MRP and Net Quantity are required');
        const r = await api.validateUSP(
          parseFloat(mrp), parseFloat(qty), unit,
          printedUsp ? parseFloat(printedUsp) : undefined
        );
        setResult(r);
      } else {
        if (!analysisId) throw new Error('Analysis ID is required');
        const r = await api.extractValidateUSP(parseInt(analysisId));
        setResult(r);
      }
    } catch (e: any) {
      setError(e.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = result
    ? result.status === 'PASS' ? '#22C55E' : result.status === 'FAIL' ? '#EF4444' : result.status === 'WARN' ? '#F59E0B' : '#94A3B8'
    : 'var(--text-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div className="section-label" style={{ marginBottom: '6px' }}>Rule 18 Compliance Check</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}>USP Validator</h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '5px 0 0' }}>
          Validates Unit Sale Price — LM-PC Rule 18. USP = MRP ÷ Net Quantity (base unit)
        </p>
      </div>

      {/* Info callout */}
      <div style={{ display: 'flex', gap: '10px', padding: '14px 16px', background: 'var(--surface-low)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)' }}>
        <Info size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Rule 18 of LM-PC Rules 2011 requires Unit Sale Price (USP) to be printed on all packaged commodities.
          USP is computed as MRP divided by the net quantity in its base unit (e.g. ₹/g, ₹/ml).
          A ±{2}% tolerance is applied to account for rounding on printed labels.
        </div>
      </div>

      {/* Mode toggle */}
      <div className="tab-container" style={{ maxWidth: '320px' }}>
        {(['manual', 'ocr'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setError(null); }}
            className={`tab-button ${mode === m ? 'active' : ''}`}
          >
            {m === 'manual' ? '✏ Manual Entry' : '🔍 From Analysis OCR'}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem', fontFamily: 'var(--font-body)' }}>
          {error}
        </div>
      )}

      {/* Form */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {mode === 'manual' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* MRP */}
            <div>
              <label className="form-label">MRP (₹) *</label>
              <input
                type="number" step="0.01" min="0.01" value={mrp}
                onChange={e => setMrp(e.target.value)}
                placeholder="e.g. 99.00"
                className="premium-input"
                style={{ width: '100%' }}
              />
            </div>
            {/* Qty + unit */}
            <div>
              <label className="form-label">Net Quantity *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number" step="0.001" min="0.001" value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 200"
                  className="premium-input"
                  style={{ flex: 1 }}
                />
                <select
                  value={unit} onChange={e => setUnit(e.target.value)}
                  className="premium-input"
                  style={{ minWidth: '75px' }}
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {/* Printed USP */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                Printed USP on label (₹/{unit}) — <span style={{ fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, fontSize: '10px', color: 'var(--text-muted)' }}>optional</span>
              </label>
              <input
                type="number" step="0.0001" min="0" value={printedUsp}
                onChange={e => setPrintedUsp(e.target.value)}
                placeholder={`e.g. ${mrp && qty ? (parseFloat(mrp) / parseFloat(qty)).toFixed(4) : '0.4950'}`}
                className="premium-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="form-label">Analysis ID *</label>
            <input
              type="number" value={analysisId}
              onChange={e => setAnalysisId(e.target.value)}
              placeholder="Enter analysis ID from Audit Reports"
              className="premium-input"
              style={{ width: '100%' }}
            />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              MRP, Net Quantity and Printed USP will be auto-extracted from the OCR text of that analysis.
            </p>
          </div>
        )}
        <button onClick={validate} disabled={loading} className="btn" style={{ marginTop: '18px', padding: '11px 24px', fontSize: '0.9rem', gap: '8px' }}>
          <Calculator size={15} style={{ color: '#E3F0A3' }} />
          {loading ? 'Validating…' : 'Validate USP'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Status header */}
          <div style={{
            padding: '18px 22px',
            background: result.status === 'PASS' ? 'var(--success-bg)' : result.status === 'FAIL' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            display: 'flex', alignItems: 'center', gap: '12px',
            borderBottom: '1px solid var(--border)',
          }}>
            <StatusIcon status={result.status} />
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 700, color: statusColor }}>USP {result.status}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Confidence: {(result.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          {/* Details */}
          <div style={{ padding: '18px 22px' }}>
            <p style={{ fontFamily: 'var(--font-body)', margin: '0 0 16px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.message}</p>
            <ResultRow label="MRP" value={result.mrp !== null ? `₹${result.mrp}` : null} />
            <ResultRow label="Net Quantity" value={result.net_quantity !== null ? `${result.net_quantity} ${result.quantity_unit}` : null} />
            <ResultRow label="Base Unit" value={result.quantity_base_unit} />
            <ResultRow label="Computed USP" value={result.computed_usp !== null ? `₹${result.computed_usp?.toFixed(4)}/${result.quantity_base_unit}` : null} highlight="var(--success)" />
            {result.printed_usp !== null && (
              <ResultRow label="Printed USP" value={`₹${result.printed_usp?.toFixed(4)}/${result.quantity_base_unit}`} />
            )}
            {result.difference_pct !== null && (
              <ResultRow label="Difference" value={`${result.difference_pct}%`} highlight={result.difference_pct > result.tolerance_pct ? 'var(--danger)' : 'var(--success)'} />
            )}
            <ResultRow label="Tolerance" value={`±${result.tolerance_pct}%`} />
          </div>
        </div>
      )}
    </div>
  );
}
