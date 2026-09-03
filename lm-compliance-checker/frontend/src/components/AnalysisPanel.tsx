import React, { useState } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, FileText,
  HelpCircle, Download, ChevronDown, ChevronUp,
  Copy, Check, FileCheck, Save, ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { AnalysisResponse, Finding } from '../services/api';

interface AnalysisPanelProps {
  analysis: AnalysisResponse;
}

/* ── Status icon ─────────────────────────────────────────── */
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PASS': return <CheckCircle size={20} color="var(--success)" />;
    case 'FAIL': return <AlertTriangle size={20} color="var(--danger)" />;
    case 'WARN': return <AlertTriangle size={20} color="var(--warning)" />;
    default:     return <HelpCircle   size={20} color="var(--text-muted)" />;
  }
};

/* ── Status chip colour ──────────────────────────────────── */
const statusChipClass = (status: string) => {
  switch (status) {
    case 'PASS': return 'chip chip-success';
    case 'FAIL': return 'chip chip-danger';
    case 'WARN': return 'chip chip-warning';
    default:     return 'chip chip-default';
  }
};

/* ── Rule status label ───────────────────────────────────── */
const statusLabel = (status: string) => {
  switch (status) {
    case 'PASS': return 'Passed';
    case 'FAIL': return 'Failed';
    case 'WARN': return 'Warning';
    default:     return 'Unknown';
  }
};

/* ═══════════════════════════════════════════════════════════
   ANALYSIS PANEL
   ═══════════════════════════════════════════════════════════ */
export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis }) => {
  const { summary, findings, ocr_text } = analysis;
  const [ocrOpen, setOcrOpen]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [meta, setMeta]         = useState({
    company_name:   analysis.company_name   || '',
    product_name:   analysis.product_name   || '',
    auditor_notes:  analysis.auditor_notes  || '',
  });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaved,  setMetaSaved]  = useState(false);

  const overallStatus = summary.FAIL === 0 ? 'COMPLIANT' : 'VIOLATION';
  const statusColor   = overallStatus === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)';
  const ringColor     = overallStatus === 'COMPLIANT' ? 'var(--accent)' : '#EF4444';

  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analysis, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `compliance_report_${analysis.analysis_id}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copyToClipboard = () => {
    if (ocr_text) {
      navigator.clipboard.writeText(ocr_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveMeta = async () => {
    setMetaSaving(true);
    try {
      await api.updateMetadata(analysis.analysis_id, meta);
      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setMetaSaving(false);
    }
  };

  /* ── Summary counts ── */
  const totalRules = summary.total_rules || findings.length;
  const passCount  = summary.PASS || 0;
  const failCount  = summary.FAIL || 0;
  const warnCount  = summary.WARN || 0;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Export bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', gap: '10px' }}>
        <button
          className="btn"
          onClick={() => api.downloadPDF(analysis.analysis_id, summary.FAIL > 0)}
          style={{ gap: '7px', padding: '9px 18px', fontSize: '0.875rem' }}
        >
          <FileCheck size={15} style={{ color: '#E3F0A3' }} />
          Export PDF
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleDownload}
          style={{ gap: '7px', padding: '9px 18px', fontSize: '0.875rem' }}
        >
          <Download size={15} />
          Export JSON
        </button>
      </div>

      {/* ── Score Banner ── */}
      <div className="score-banner">
        {/* Left: circular score ring + summary text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Ring */}
          <div style={{
            width: '84px', height: '84px', borderRadius: '50%',
            border: `4px solid ${ringColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
            boxShadow: `0 0 0 6px ${ringColor}18`,
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 700,
              color: statusColor, lineHeight: 1,
            }}>
              {summary.compliance_score}%
            </span>
          </div>

          {/* Text block */}
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: '5px', letterSpacing: '-0.015em',
            }}>
              Compliance Score
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              {passCount} of {totalRules} Legal Metrology rules passed
            </p>
            {/* Mini stat pills */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span className="chip chip-success">{passCount} Passed</span>
              {warnCount > 0 && <span className="chip chip-warning">{warnCount} Warning</span>}
              {failCount > 0 && <span className="chip chip-danger">{failCount} Failed</span>}
            </div>
          </div>
        </div>

        {/* Right: verdict pill */}
        <div className={`verdict-pill ${overallStatus}`} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.9rem',
        }}>
          {overallStatus === 'COMPLIANT'
            ? <ShieldCheck size={16} />
            : <AlertTriangle size={16} />}
          {overallStatus === 'COMPLIANT' ? 'Fully Compliant' : 'Violations Detected'}
        </div>
      </div>

      {/* ── Audit Metadata ── */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '22px', marginBottom: '24px',
        boxShadow: 'var(--shadow-1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
            color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0,
          }}>
            Audit Metadata
          </h3>
          <button
            onClick={handleSaveMeta}
            disabled={metaSaving}
            className={metaSaved ? 'btn btn-accent' : 'btn btn-secondary'}
            style={{ gap: '6px', padding: '7px 14px', fontSize: '0.82rem' }}
          >
            {metaSaved ? <Check size={13} /> : <Save size={13} />}
            {metaSaving ? 'Saving…' : metaSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
          {[
            { label: 'Company Name', key: 'company_name', placeholder: 'e.g. Acme Corp' },
            { label: 'Product Name', key: 'product_name', placeholder: 'e.g. Acme Soap 100g' },
          ].map(f => (
            <div key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                type="text"
                value={meta[f.key as keyof typeof meta]}
                onChange={e => setMeta({ ...meta, [f.key]: e.target.value })}
                className="premium-input"
                style={{ width: '100%' }}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        <div>
          <label className="form-label">Auditor Notes</label>
          <textarea
            value={meta.auditor_notes}
            onChange={e => setMeta({ ...meta, auditor_notes: e.target.value })}
            className="premium-input"
            style={{ width: '100%', minHeight: '68px', resize: 'vertical' }}
            placeholder="Any specific remarks or conditions noted during inspection…"
          />
        </div>
      </div>

      {/* ── Rule Breakdown Grid ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h3 style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1.1rem',
            color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0,
          }}>
            Rule Verification Breakdown
          </h3>
          <span className="chip chip-default">{totalRules} rules</span>
        </div>
        <div className="rule-grid">
          {findings.map((finding: Finding, idx: number) => (
            <div key={idx} className="rule-card">
              {/* Rule header */}
              <div className="rule-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Status icon bubble */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                    background: finding.status === 'PASS'
                      ? 'var(--success-bg)'
                      : finding.status === 'FAIL'
                      ? 'var(--danger-bg)'
                      : 'var(--warning-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {getStatusIcon(finding.status)}
                  </div>
                  <div>
                    <h4 className="rule-title">{finding.rule_name}</h4>
                    <span className="rule-section">§ {finding.rule_code}</span>
                  </div>
                </div>
                <span className={statusChipClass(finding.status)} style={{ flexShrink: 0 }}>
                  {statusLabel(finding.status)}
                </span>
              </div>

              {/* Message */}
              <p className="rule-feedback">{finding.message}</p>

              {/* Extracted value */}
              {finding.extracted_value && (
                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                  <div className="form-label" style={{ marginBottom: '5px' }}>Extracted Value</div>
                  <div className="extracted-chip">{finding.extracted_value}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Raw OCR Drawer ── */}
      <div className="ocr-drawer">
        <div className="ocr-drawer-header" onClick={() => setOcrOpen(!ocrOpen)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <FileText size={16} color="var(--text-muted)" />
            <h3 style={{
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
              color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0,
            }}>
              Raw Extracted OCR Text
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem' }}>
              {ocrOpen ? 'Collapse' : 'Expand'}
            </span>
            {ocrOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {ocrOpen && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={copyToClipboard}
              className="btn btn-secondary"
              style={{
                position: 'absolute', top: '12px', right: '12px',
                padding: '5px 10px', fontSize: '0.78rem', gap: '5px',
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <div className="ocr-text">
              {ocr_text
                ? ocr_text
                : <span style={{ opacity: 0.4 }}>No text extracted from this image.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
