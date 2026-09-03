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
  const styles: Record<string, React.CSSProperties> = {
    cream:  { background: 'var(--tint-cream)',  color: 'var(--primary)',   border: '1px solid var(--tint-sage)' },
    forest: { background: 'var(--primary)',       color: '#E3F0A3',          border: '1px solid var(--primary)' },
    sage:   { background: 'rgba(186,219,162,0.3)', color: 'var(--text-secondary)', border: '1px solid var(--tint-sage)' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 12px', borderRadius: 'var(--radius-full)',
      fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      ...styles[variant],
    }}>
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
  <div className="glass-card" style={{
    padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px',
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '14px',
      background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={22} color={iconColor} />
    </div>
    <div style={{ flex: 1 }}>
      <h3 style={{
        fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em',
      }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</p>
    </div>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {actions.map(a => (
        <button key={a.label} className="btn btn-secondary" onClick={a.onClick}
          style={{ padding: '7px 16px', fontSize: '0.82rem' }}>
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
    <div style={{ paddingBottom: '72px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ═══ HERO SECTION ═══════════════════════════════════ */}
      <section className="animate-fade-in" style={{
        padding: '56px 0 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '28px',
        position: 'relative',
      }}>

        {/* Gazette sync badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderRadius: 'var(--radius-full)',
          background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border-strong)',
          backdropFilter: 'blur(10px)',
        }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'var(--accent)', opacity: 0.65,
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <span style={{
              position: 'relative', width: '8px', height: '8px',
              borderRadius: '50%', background: 'var(--accent)',
            }} />
          </span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-primary)',
          }}>
            Gazette Notification &amp; 2024 Amendments Synced
          </span>
          <span style={{ color: 'var(--tint-sage)', fontSize: '12px' }}>•</span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600,
            color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Rule 6(1) Enforced
          </span>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 420px', gap: '48px',
          alignItems: 'start', width: '100%',
        }}>

          {/* Left column – headline + CTAs + metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4vw,44px)',
              fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.025em',
              color: 'var(--text-primary)', margin: 0,
            }}>
              Automated Packaging Compliance for{' '}
              <span style={{
                fontStyle: 'italic', color: 'var(--primary)',
                textDecoration: 'underline', textDecorationColor: 'var(--accent)',
                textDecorationThickness: '3px', textUnderlineOffset: '6px',
              }}>
                Legal Metrology
              </span>{' '}
              (PCR 2011)
            </h1>

            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: 1.7,
              color: 'var(--text-secondary)', margin: 0, maxWidth: '520px',
            }}>
              Zero-defect regulatory verification for FMCG, Pharma, Cosmetics, and E-Commerce.
              Scan packaging artwork, verify mandatory declarations, validate font heights against
              PDP area tables, and eliminate compounding penalties before market dispatch.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
              <button
                className="btn"
                onClick={() => navigate('/scan')}
                style={{ padding: '12px 24px', fontSize: '0.95rem', gap: '8px' }}
              >
                <Scan size={18} style={{ color: '#E3F0A3' }} />
                Launch Instant Artwork Audit
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
                style={{ padding: '12px 22px', fontSize: '0.95rem', gap: '8px' }}
              >
                <Activity size={17} />
                View Control Center
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Metric tiles */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
              gap: '12px', paddingTop: '8px',
            }}>
              {[
                { value: 4.2, suffix: 'M+', label: 'SKUs Audited',        color: 'var(--primary)' },
                { value: 99.84, suffix: '%', label: 'Statutory Accuracy', color: 'var(--success)' },
                { value: 18.4, prefix: '₹', suffix: 'Cr', label: 'Penalties Prevented', color: 'var(--primary)' },
                { value: 1.4, prefix: '< ', suffix: 's', label: 'Inference Latency',   color: 'var(--text-muted)' },
              ].map(m => (
                <div key={m.label} style={{
                  padding: '14px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(186,219,162,0.7)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: 'var(--shadow-1)',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700,
                    letterSpacing: '-0.02em', color: m.color, lineHeight: 1,
                  }}>
                    <AnimatedCounter end={m.value} prefix={m.prefix} suffix={m.suffix} />
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', marginTop: '5px',
                  }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column – Live Watchdog widget */}
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(186,219,162,0.8)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-2)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}>
            {/* Card header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingBottom: '14px', borderBottom: '1px solid rgba(186,219,162,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--primary)" />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600,
                  color: 'var(--primary)', letterSpacing: '-0.01em',
                }}>
                  LMPC Statutory Watchdog
                </span>
              </div>
              <LabelBadge variant="cream">Active Enforcement</LabelBadge>
            </div>

            {/* Font height calculator */}
            <div style={{
              background: 'var(--surface-low)', border: '1px solid rgba(186,219,162,0.6)',
              borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)',
              }}>
                Minimum Font Height Calculator (Rule 7)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">PDP Area (cm²)</label>
                  <input
                    className="premium-input"
                    type="number" defaultValue={180} min={10} max={2500}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="form-label">Net Weight / Vol</label>
                  <input
                    className="premium-input"
                    type="text" defaultValue="500 g"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: '8px',
                background: 'var(--surface-card)', border: '1px solid rgba(186,219,162,0.5)',
              }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Required Font Height:
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700,
                  color: 'var(--primary)', background: 'rgba(227,240,163,0.6)',
                  padding: '3px 10px', borderRadius: '6px',
                }}>
                  ≥ 4.0 mm
                </span>
              </div>
            </div>

            {/* Warning notice */}
            <div style={{
              display: 'flex', gap: '10px', padding: '12px 14px',
              borderRadius: '10px', background: '#FFFBEB',
              border: '1px solid #FDE68A', alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600,
                  color: '#78350F', marginBottom: '3px',
                }}>
                  Section 36 Compliance Warning
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#92400E', lineHeight: 1.55 }}>
                  Non-compliant declarations attract fines up to ₹25,000 for the first offence
                  and mandatory packaging seizure.
                </p>
              </div>
            </div>

            <button className="btn" onClick={() => navigate('/scan')} style={{ justifyContent: 'center' }}>
              <Scan size={16} style={{ color: '#E3F0A3' }} />
              Validate My Packaging Now
            </button>
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE PREVIEW ═══════════════════════════ */}
      <section style={{ marginTop: '16px' }} className="animate-fade-in">
        <div style={{ marginBottom: '28px' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>Interactive Label Inspection Canvas</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px',
          }}>
            See Compliance Analysis in Action
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '520px', lineHeight: 1.6 }}>
            Switch between packaging scenarios below to preview how the AI engine flags violations in real time.
          </p>
        </div>

        <div className="glass-card" style={{
          display: 'grid', gridTemplateColumns: '1fr 300px', gap: '0', padding: '0', overflow: 'hidden',
        }}>
          {/* Preview area */}
          <div style={{ padding: '24px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <select
                className="premium-input"
                value={selectedPreset}
                onChange={e => setSelectedPreset(e.target.value as keyof typeof presets)}
                style={{ width: '260px' }}
              >
                {Object.entries(presets).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={() => navigate('/scan')} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                Test Your Own Packaging
              </button>
            </div>

            <div style={{
              position: 'relative', width: '100%', height: '360px',
              borderRadius: '12px', overflow: 'hidden',
              border: '1px solid var(--border-strong)',
            }}>
              <div style={{
                width: '100%', height: '100%',
                background: `linear-gradient(rgba(14,42,27,0.45),rgba(14,42,27,0.45)), url(${preset.image})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }} />
              {preset.boxes.map(box => (
                <div key={box.id} style={{
                  position: 'absolute',
                  top: `${box.top}%`, left: `${box.left}%`,
                  width: `${box.width}%`, height: `${box.height}%`,
                  border: `2px solid ${box.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444'}`,
                  backgroundColor: box.status === 'COMPLIANT' ? 'rgba(66,214,116,0.12)' : 'rgba(239,68,68,0.12)',
                  borderRadius: '4px',
                  display: 'flex', alignItems: 'flex-start',
                  padding: '3px', transition: 'all 0.35s ease',
                }}>
                  <span style={{
                    background: box.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444',
                    color: box.status === 'COMPLIANT' ? 'var(--primary)' : '#fff',
                    fontSize: '9px', fontFamily: 'var(--font-body)', fontWeight: 700,
                    padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}>
                    {box.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis sidebar */}
          <div style={{ padding: '24px', background: 'var(--surface-low)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{
              fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)',
            }}>
              <ShieldCheck size={18} color={preset.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)'} />
              Analysis Results
            </h3>

            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                border: `4px solid ${preset.status === 'COMPLIANT' ? 'var(--accent)' : '#EF4444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 700,
                color: preset.status === 'COMPLIANT' ? 'var(--success)' : 'var(--danger)',
              }}>
                {preset.score}
              </div>
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Compliance Score
                </div>
                <span className={`chip ${preset.status === 'COMPLIANT' ? 'chip-success' : 'chip-danger'}`}>
                  {preset.status}
                </span>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Rule results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {preset.boxes.map(box => (
                <div key={box.id} style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '10px 12px', borderRadius: '9px',
                  background: 'var(--surface-card)', border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-1)',
                }}>
                  {box.status === 'COMPLIANT'
                    ? <CheckCircle size={15} color="var(--success)" />
                    : <AlertTriangle size={15} color="var(--danger)" />}
                  <span style={{
                    flex: 1, fontSize: '0.82rem', fontFamily: 'var(--font-body)',
                    fontWeight: 500, color: 'var(--text-primary)',
                  }}>
                    {box.label.split(':')[0]}
                  </span>
                  <span className={`chip ${box.status === 'COMPLIANT' ? 'chip-success' : 'chip-danger'}`}
                    style={{ fontSize: '9px', padding: '3px 8px' }}>
                    {box.status === 'COMPLIANT' ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURE CARDS ═══════════════════════════════════ */}
      <section style={{ marginTop: '72px' }} className="animate-fade-in">
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <div className="section-label" style={{ marginBottom: '8px' }}>Platform Capabilities</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--text-primary)',
          }}>
            Architected for Zero Packaging Prosecutions
          </h2>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px',
            margin: '10px auto 0', lineHeight: 1.65,
          }}>
            Every module resolves a specific compliance gap, packages inspection failures, and drives measurable risk reduction.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '20px' }}>
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
