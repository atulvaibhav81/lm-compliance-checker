import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck, Scan, Layers, FileText, Activity,
  Calculator, AlertTriangle, CheckCircle, ArrowRight,
  BookOpen, Zap, TrendingUp
} from 'lucide-react';

/* ── Animated counter ──────────────────────────────────── */
const AnimatedCounter = ({
  end, duration = 2000, suffix = '', prefix = '',
}: { end: number; duration?: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    let id: number;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const pct = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 4);
      setCount(Math.floor(end * ease));
      if (pct < 1) id = requestAnimationFrame(animate);
      else if (end % 1 !== 0) setCount(end);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [end, duration]);
  const display = end % 1 !== 0 ? count.toFixed(1) : count;
  return <span>{prefix}{display}{suffix}</span>;
};

/* ── Label badge ────────────────────────────────────────── */
const LabelBadge = ({ children, variant = 'cream' }: { children: React.ReactNode; variant?: 'cream' | 'forest' | 'sage' }) => {
  const styles: Record<string, string> = {
    cream:  'bg-[var(--tint-cream)] text-[var(--primary)] border-[var(--tint-sage)]',
    forest: 'bg-[var(--primary)] text-[#E3F0A3] border-[var(--primary)]',
    sage:   'bg-[rgba(186,219,162,0.3)] text-[var(--text-secondary)] border-[var(--tint-sage)]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-[family-name:var(--font-body)] text-[10px] font-bold tracking-widest uppercase border ${styles[variant]}`}>
      {children}
    </span>
  );
};

/* ── Preset data for interactive preview ─────────────────── */
const presets = {
  compliant: {
    label: 'Compliant FMCG Box',
    image: 'https://images.unsplash.com/photo-1626285861696-9f0eb5a40227?w=600&auto=format&fit=crop&q=70',
    boxes: [
      { id: 1, label: 'MRP: ₹50.00',               status: 'COMPLIANT', top: 18, left: 28, width: 44, height: 12 },
      { id: 2, label: 'Net Qty: 100g',              status: 'COMPLIANT', top: 40, left: 28, width: 44, height: 12 },
      { id: 3, label: 'Font Height: 1.2mm (≥1mm)',  status: 'COMPLIANT', top: 62, left: 28, width: 44, height: 12 },
    ],
    score: 100, status: 'COMPLIANT',
  },
  missingQty: {
    label: 'Missing Net Qty Declaration',
    image: 'https://images.unsplash.com/photo-1584820927498-cafe8c12a806?w=600&auto=format&fit=crop&q=70',
    boxes: [
      { id: 1, label: 'MRP: ₹120.00',    status: 'COMPLIANT', top: 28, left: 18, width: 52, height: 14 },
      { id: 2, label: 'Missing Net Qty', status: 'VIOLATION',  top: 52, left: 18, width: 52, height: 14 },
    ],
    score: 65, status: 'VIOLATION',
  },
  fontViolation: {
    label: 'Font Size Violation',
    image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=600&auto=format&fit=crop&q=70',
    boxes: [
      { id: 1, label: 'MRP: ₹45.00',                status: 'COMPLIANT', top: 24, left: 32, width: 36, height: 13 },
      { id: 2, label: 'Net Qty: 200g',               status: 'COMPLIANT', top: 45, left: 32, width: 36, height: 13 },
      { id: 3, label: 'Font 0.8mm (Req ≥1mm)',       status: 'VIOLATION',  top: 66, left: 32, width: 36, height: 13 },
    ],
    score: 80, status: 'VIOLATION',
  },
};

/* ── Feature card ────────────────────────────────────────── */
const FeatureCard = ({
  icon: Icon, iconColor, iconBg, title, desc, actions,
}: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  title: string; desc: string;
  actions: { label: string; onClick: () => void }[];
}) => (
  <div className="glass-card flex flex-col gap-4.5 p-7">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
      <Icon size={22} color={iconColor} />
    </div>
    <div className="flex-1">
      <h3 className="font-[family-name:var(--font-body)] text-[1.05rem] font-bold text-[var(--text-primary)] mb-2 tracking-tight">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{desc}</p>
    </div>
    <div className="flex gap-2 flex-wrap">
      {actions.map(a => (
        <button key={a.label} className="btn btn-secondary px-4 py-2 text-[0.82rem]" onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════ */
const Home = () => {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof presets>('compliant');
  const preset = presets[selectedPreset];

  return (
    <div className="pb-18 max-w-6xl mx-auto">

      {/* ═══ HERO SECTION ═══════════════════════════════════ */}
      <section className="animate-fade-in flex flex-col items-start gap-7 relative py-8 md:py-14">

        {/* Gazette sync badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-full bg-white/90 border border-[var(--border-strong)] backdrop-blur-md">
          <span className="relative inline-flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-65 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="font-[family-name:var(--font-body)] text-[9px] md:text-[11px] font-bold tracking-widest uppercase text-[var(--text-primary)]">
            Gazette Notification & 2024 Amendments Synced
          </span>
          <span className="text-[var(--tint-sage)] text-xs hidden sm:inline">•</span>
          <span className="font-[family-name:var(--font-body)] text-[9px] md:text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase hidden sm:inline">
            Rule 6(1) Enforced
          </span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 lg:gap-12 items-start w-full">

          {/* Left column – headline + CTAs + metrics */}
          <div className="flex flex-col gap-6">
            <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-[clamp(30px,4vw,44px)] font-bold leading-tight tracking-tight text-[var(--text-primary)] m-0">
              Automated Packaging Compliance for{' '}
              <span className="italic text-[var(--primary)] underline decoration-[var(--accent)] decoration-3 underline-offset-4 md:underline-offset-6">
                Legal Metrology
              </span>{' '}
              (PCR 2011)
            </h1>

            <p className="font-[family-name:var(--font-body)] text-base leading-relaxed text-[var(--text-secondary)] m-0 max-w-lg">
              Zero-defect regulatory verification for FMCG, Pharma, Cosmetics, and E-Commerce.
              Scan packaging artwork, verify mandatory declarations, validate font heights against
              PDP area tables, and eliminate compounding penalties before market dispatch.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                className="btn w-full sm:w-auto px-6 py-3 text-[0.95rem] gap-2 justify-center"
                onClick={() => navigate('/scan')}
              >
                <Scan size={18} className="text-[#E3F0A3]" />
                Launch Instant Artwork Audit
              </button>
              <button
                className="btn btn-secondary w-full sm:w-auto px-6 py-3 text-[0.95rem] gap-2 justify-center"
                onClick={() => navigate('/dashboard')}
              >
                <Activity size={17} />
                View Control Center
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Metric tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { value: 4.2, suffix: 'M+', label: 'SKUs Audited',        color: 'var(--primary)' },
                { value: 99.84, suffix: '%', label: 'Statutory Accuracy', color: 'var(--success)' },
                { value: 18.4, prefix: '₹', suffix: 'Cr', label: 'Penalties Prevented', color: 'var(--primary)' },
                { value: 1.4, prefix: '< ', suffix: 's', label: 'Inference Latency',   color: 'var(--text-muted)' },
              ].map(m => (
                <div key={m.label} className="p-3.5 rounded-xl bg-white/85 border border-[rgba(186,219,162,0.7)] backdrop-blur-md shadow-[var(--shadow-1)]">
                  <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight leading-none" style={{ color: m.color }}>
                    <AnimatedCounter end={m.value} prefix={m.prefix} suffix={m.suffix} />
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[9px] font-bold tracking-widest uppercase text-[var(--text-muted)] mt-1.5">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column – Live Watchdog widget */}
          <div className="bg-white/95 border border-[rgba(186,219,162,0.8)] rounded-2xl p-5 md:p-6 shadow-[var(--shadow-2)] backdrop-blur-xl flex flex-col gap-4">
            {/* Card header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-3.5 border-b border-[rgba(186,219,162,0.5)]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} color="var(--primary)" />
                <span className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--primary)] tracking-tight">
                  LMPC Statutory Watchdog
                </span>
              </div>
              <LabelBadge variant="cream">Active Enforcement</LabelBadge>
            </div>

            {/* Font height calculator */}
            <div className="bg-[var(--surface-low)] border border-[rgba(186,219,162,0.6)] rounded-xl p-4 flex flex-col gap-3">
              <div className="font-[family-name:var(--font-body)] text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
                Minimum Font Height Calculator (Rule 7)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="form-label">PDP Area (cm²)</label>
                  <input
                    className="premium-input w-full"
                    type="number" defaultValue={180} min={10} max={2500}
                  />
                </div>
                <div>
                  <label className="form-label">Net Weight / Vol</label>
                  <input
                    className="premium-input w-full"
                    type="text" defaultValue="500 g"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center px-3.5 py-2.5 rounded-lg bg-[var(--surface-card)] border border-[rgba(186,219,162,0.5)] mt-1">
                <span className="font-[family-name:var(--font-body)] text-[0.85rem] text-[var(--text-secondary)] font-medium">
                  Required Font Height:
                </span>
                <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--primary)] bg-[rgba(227,240,163,0.6)] px-2.5 py-1 rounded-md">
                  ≥ 4.0 mm
                </span>
              </div>
            </div>

            {/* Warning notice */}
            <div className="flex gap-2.5 px-3.5 py-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] items-start">
              <AlertTriangle size={16} color="#B45309" className="shrink-0 mt-0.5" />
              <div>
                <div className="font-[family-name:var(--font-display)] text-[0.875rem] font-semibold text-[#78350F] mb-1">
                  Section 36 Compliance Warning
                </div>
                <p className="font-[family-name:var(--font-body)] text-xs text-[#92400E] leading-relaxed m-0">
                  Non-compliant declarations attract fines up to ₹25,000 for the first offence
                  and mandatory packaging seizure.
                </p>
              </div>
            </div>

            <button className="btn justify-center w-full" onClick={() => navigate('/scan')}>
              <Scan size={16} className="text-[#E3F0A3]" />
              Validate My Packaging Now
            </button>
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE PREVIEW ═══════════════════════════ */}
      <section className="mt-8 md:mt-12 animate-fade-in">
        <div className="mb-7 md:text-center text-left">
          <div className="section-label mb-2">Interactive Label Inspection Canvas</div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2">
            See Compliance Analysis in Action
          </h2>
          <p className="text-[var(--text-secondary)] text-sm md:text-[0.9rem] max-w-lg md:mx-auto leading-relaxed">
            Switch between packaging scenarios below to preview how the AI engine flags violations in real time.
          </p>
        </div>

        <div className="glass-card grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-0 p-0 overflow-hidden">
          {/* Preview area */}
          <div className="p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <select
                className="premium-input w-full sm:w-64"
                value={selectedPreset}
                onChange={e => setSelectedPreset(e.target.value as keyof typeof presets)}
              >
                {Object.entries(presets).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button className="btn btn-secondary text-[0.82rem] px-4 py-2 w-full sm:w-auto justify-center" onClick={() => navigate('/scan')}>
                Test Your Own Packaging
              </button>
            </div>

            <div className="relative w-full h-64 md:h-[360px] rounded-xl overflow-hidden border border-[var(--border-strong)]">
              <div 
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `linear-gradient(rgba(14,42,27,0.45),rgba(14,42,27,0.45)), url(${preset.image})` }}
              />
              {preset.boxes.map(box => (
                <div key={box.id} className="absolute border-2 rounded flex items-start p-0.5 md:p-1 transition-all duration-300 ease-in-out" style={{
                  top: `${box.top}%`, left: `${box.left}%`,
                  width: `${box.width}%`, height: `${box.height}%`,
                  borderColor: box.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444',
                  backgroundColor: box.status === 'COMPLIANT' ? 'rgba(66,214,116,0.12)' : 'rgba(239,68,68,0.12)',
                }}>
                  <span className="text-[7px] md:text-[9px] font-[family-name:var(--font-body)] font-bold px-1 py-0.5 md:px-1.5 md:py-0.5 rounded whitespace-nowrap tracking-wider" style={{
                    background: box.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444',
                    color: box.status === 'COMPLIANT' ? 'var(--primary)' : '#fff',
                  }}>
                    {box.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis sidebar */}
          <div className="p-4 md:p-6 bg-[var(--surface-low)] flex flex-col gap-4">
            <h3 className="font-[family-name:var(--font-body)] text-base font-bold flex items-center gap-2 text-[var(--text-primary)]">
              <ShieldCheck size={18} className={preset.status === 'COMPLIANT' ? 'text-[var(--success)]' : 'text-[var(--danger)]'} />
              Analysis Results
            </h3>

            {/* Score */}
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full border-4 flex items-center justify-center text-xl md:text-[1.4rem] font-[family-name:var(--font-display)] font-bold" style={{
                borderColor: preset.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444',
                color: preset.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)',
              }}>
                {preset.score}
              </div>
              <div>
                <div className="text-[10px] md:text-[11px] font-[family-name:var(--font-body)] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  Compliance Score
                </div>
                <span className={`chip ${preset.status === 'COMPLIANT' ? 'chip-success' : 'chip-danger'}`}>
                  {preset.status}
                </span>
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Rule results */}
            <div className="flex flex-col gap-2">
              {preset.boxes.map(box => (
                <div key={box.id} className="flex items-center gap-2 p-2 md:p-2.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] shadow-[var(--shadow-1)]">
                  {box.status === 'COMPLIANT'
                    ? <CheckCircle size={15} className="text-[var(--success)] shrink-0" />
                    : <AlertTriangle size={15} className="text-[var(--danger)] shrink-0" />}
                  <span className="flex-1 text-xs md:text-[0.82rem] font-[family-name:var(--font-body)] font-medium text-[var(--text-primary)] truncate">
                    {box.label.split(':')[0]}
                  </span>
                  <span className={`chip ${box.status === 'COMPLIANT' ? 'chip-success' : 'chip-danger'} text-[9px] px-2 py-0.5`}>
                    {box.status === 'COMPLIANT' ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURE CARDS ═══════════════════════════════════ */}
      <section className="mt-12 md:mt-18 animate-fade-in">
        <div className="mb-7 md:mb-9 md:text-center text-left">
          <div className="section-label mb-2">Platform Capabilities</div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Architected for Zero Packaging Prosecutions
          </h2>
          <p className="text-[var(--text-secondary)] text-sm md:text-[0.9rem] max-w-lg md:mx-auto mt-2.5 leading-relaxed">
            Every module resolves a specific compliance gap, packages inspection failures, and drives measurable risk reduction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={Layers} iconColor="var(--info)" iconBg="var(--info-bg)"
            title="Font Size Compliance"
            desc="Automated font height measurement and rule threshold validation for principal display panels under Rule 7."
            actions={[{ label: 'Try Tool', onClick: () => navigate('/scan') }]}
          />
          <FeatureCard
            icon={Scan} iconColor="var(--success)" iconBg="var(--success-bg)"
            title="Single & Batch Scanning"
            desc="Upload individual photos or bulk batches for automated processing, rule analysis, and compliance reporting."
            actions={[
              { label: 'Single Scan', onClick: () => navigate('/scan') },
              { label: 'Batch Scan',  onClick: () => navigate('/batch') },
            ]}
          />
          <FeatureCard
            icon={FileText} iconColor="var(--primary)" iconBg="rgba(19,56,32,0.08)"
            title="Audit Reports"
            desc="Searchable records with status filtering, PDF compliance certificates, and full rule-level audit trail."
            actions={[{ label: 'View Reports', onClick: () => navigate('/reports') }]}
          />
          <FeatureCard
            icon={TrendingUp} iconColor="var(--warning)" iconBg="var(--warning-bg)"
            title="Enterprise Control Center"
            desc="Compliance trend charts, KPI scorecards, and historical analytics aggregated across all processed labels."
            actions={[{ label: 'Open Dashboard', onClick: () => navigate('/dashboard') }]}
          />
          <FeatureCard
            icon={Calculator} iconColor="var(--danger)" iconBg="var(--danger-bg)"
            title="Penalty Calculator"
            desc="Calculate compounding fees under LM Act 2009 for first and repeat offences with full rule matrix reference."
            actions={[{ label: 'Penalty Calc', onClick: () => navigate('/penalties') }]}
          />
          <FeatureCard
            icon={BookOpen} iconColor="var(--primary)" iconBg="var(--tint-cream)"
            title="USP Validator"
            desc="Validate Unit Sale Price formatting and net quantity declarations against PCR 2011 Rule 6 requirements."
            actions={[{ label: 'USP Validator', onClick: () => navigate('/usp') }]}
          />
        </div>
      </section>

    </div>
  );
};

export default Home;
