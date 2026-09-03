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
    case 'PASS': return <CheckCircle size={20} className="text-[var(--success)]" />;
    case 'FAIL': return <AlertTriangle size={20} className="text-[var(--danger)]" />;
    case 'WARN': return <AlertTriangle size={20} className="text-[var(--warning)]" />;
    default:     return <HelpCircle   size={20} className="text-[var(--text-muted)]" />;
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
    <div className="animate-fade-in flex flex-col">

      {/* ── Export bar ── */}
      <div className="flex flex-wrap justify-end gap-2.5 mb-5 w-full">
        <button
          className="btn flex-1 sm:flex-none justify-center px-4 py-2 text-sm gap-2"
          onClick={() => api.downloadPDF(analysis.analysis_id, summary.FAIL > 0)}
        >
          <FileCheck size={15} className="text-[#E3F0A3]" />
          Export PDF
        </button>
        <button
          className="btn btn-secondary flex-1 sm:flex-none justify-center px-4 py-2 text-sm gap-2"
          onClick={handleDownload}
        >
          <Download size={15} />
          Export JSON
        </button>
      </div>

      {/* ── Score Banner ── */}
      <div className="score-banner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 md:p-6 mb-6">
        {/* Left: circular score ring + summary text */}
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
          {/* Ring */}
          <div className="w-16 h-16 sm:w-[84px] sm:h-[84px] rounded-full border-4 flex items-center justify-center flex-col shrink-0" style={{
            borderColor: ringColor,
            boxShadow: `0 0 0 6px ${ringColor}18`,
          }}>
            <span className="font-[family-name:var(--font-display)] text-xl sm:text-2xl font-bold leading-none" style={{ color: statusColor }}>
              {summary.compliance_score}%
            </span>
          </div>

          {/* Text block */}
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl sm:text-[1.4rem] font-bold text-[var(--text-primary)] mb-1 tracking-tight">
              Compliance Score
            </h2>
            <p className="font-[family-name:var(--font-body)] text-[var(--text-secondary)] text-xs sm:text-sm m-0">
              {passCount} of {totalRules} Legal Metrology rules passed
            </p>
            {/* Mini stat pills */}
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="chip chip-success text-[10px] sm:text-xs">{passCount} Passed</span>
              {warnCount > 0 && <span className="chip chip-warning text-[10px] sm:text-xs">{warnCount} Warning</span>}
              {failCount > 0 && <span className="chip chip-danger text-[10px] sm:text-xs">{failCount} Failed</span>}
            </div>
          </div>
        </div>

        {/* Right: verdict pill */}
        <div className={`verdict-pill ${overallStatus} flex items-center gap-2 text-sm sm:text-[0.9rem] w-full sm:w-auto justify-center`}>
          {overallStatus === 'COMPLIANT'
            ? <ShieldCheck size={16} />
            : <AlertTriangle size={16} />}
          {overallStatus === 'COMPLIANT' ? 'Fully Compliant' : 'Violations Detected'}
        </div>
      </div>

      {/* ── Audit Metadata ── */}
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5 sm:p-[22px] mb-6 shadow-[var(--shadow-1)] w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-[family-name:var(--font-body)] font-bold text-base text-[var(--text-primary)] tracking-tight m-0">
            Audit Metadata
          </h3>
          <button
            onClick={handleSaveMeta}
            disabled={metaSaving}
            className={`${metaSaved ? 'btn btn-accent' : 'btn btn-secondary'} px-3 py-1.5 text-xs gap-1.5`}
          >
            {metaSaved ? <Check size={13} /> : <Save size={13} />}
            {metaSaving ? 'Saving…' : metaSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3">
          {[
            { label: 'Company Name', key: 'company_name', placeholder: 'e.g. Acme Corp' },
            { label: 'Product Name', key: 'product_name', placeholder: 'e.g. Acme Soap 100g' },
          ].map(f => (
            <div key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                type="text"
                value={(meta as any)[f.key]}
                onChange={e => setMeta({ ...meta, [f.key]: e.target.value })}
                className="premium-input w-full"
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
            className="premium-input w-full min-h-[68px] resize-y"
            placeholder="Any specific remarks or conditions noted during inspection…"
          />
        </div>
      </div>

      {/* ── Rule Breakdown Grid ── */}
      <div className="mb-6 w-full">
        <div className="flex items-center gap-2.5 mb-4">
          <h3 className="font-[family-name:var(--font-body)] font-bold text-lg text-[var(--text-primary)] tracking-tight m-0">
            Rule Verification Breakdown
          </h3>
          <span className="chip chip-default">{totalRules} rules</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {findings.map((finding: Finding, idx: number) => (
            <div key={idx} className="rule-card">
              {/* Rule header */}
              <div className="rule-header">
                <div className="flex items-start gap-3 w-full sm:w-auto overflow-hidden">
                  {/* Status icon bubble */}
                  <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{
                    background: finding.status === 'PASS'
                      ? 'var(--success-bg)'
                      : finding.status === 'FAIL'
                      ? 'var(--danger-bg)'
                      : 'var(--warning-bg)',
                  }}>
                    {getStatusIcon(finding.status)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="rule-title truncate" title={finding.rule_name}>{finding.rule_name}</h4>
                    <span className="rule-section">§ {finding.rule_code}</span>
                  </div>
                </div>
                <span className={`${statusChipClass(finding.status)} shrink-0 mt-2 sm:mt-0`}>
                  {statusLabel(finding.status)}
                </span>
              </div>

              {/* Message */}
              <p className="rule-feedback">{finding.message}</p>

              {/* Extracted value */}
              {finding.extracted_value && (
                <div className="mt-auto pt-2.5">
                  <div className="form-label mb-1">Extracted Value</div>
                  <div className="extracted-chip text-xs md:text-sm break-words">{finding.extracted_value}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Raw OCR Drawer ── */}
      <div className="ocr-drawer w-full">
        <div className="ocr-drawer-header cursor-pointer flex justify-between p-4" onClick={() => setOcrOpen(!ocrOpen)}>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[var(--text-muted)] shrink-0" />
            <h3 className="font-[family-name:var(--font-body)] font-bold text-sm text-[var(--text-primary)] tracking-tight m-0">
              Raw Extracted OCR Text
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-muted)] shrink-0">
            <span className="font-[family-name:var(--font-body)] text-xs hidden sm:inline">
              {ocrOpen ? 'Collapse' : 'Expand'}
            </span>
            {ocrOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {ocrOpen && (
          <div className="relative">
            <button
              onClick={copyToClipboard}
              className="btn btn-secondary absolute top-3 right-3 px-2.5 py-1.5 text-xs gap-1"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <div className="ocr-text max-h-64 overflow-y-auto break-words text-xs md:text-sm">
              {ocr_text
                ? ocr_text
                : <span className="opacity-40">No text extracted from this image.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
