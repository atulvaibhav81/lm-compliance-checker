import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, CheckCircle, XCircle,
  FileText, Layers, Download, RefreshCw, Clock, FileCheck, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import type { DashboardStats, ReportSummary } from '../services/api';

const CHART_GREEN   = '#42D674';
const CHART_SAGE    = '#BADBA2';
const CHART_CREAM   = '#E3F0A3';
const CHART_RED     = '#EF4444';
const CHART_AMBER   = '#F59E0B';
const PIE_COLORS    = [CHART_GREEN, CHART_AMBER, CHART_RED];
const TABLE_LIMIT   = 10;

/* ── Score badge ─────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <span className="chip chip-success">{score}%</span>;
  if (score >= 50) return <span className="chip chip-warning">{score}%</span>;
  return <span className="chip chip-danger">{score}%</span>;
}

/* ── KPI metric card ─────────────────────────────────────── */
function ScoreCard({
  title, value, sub, icon: Icon, accentColor, loading,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; accentColor: string; loading?: boolean;
}) {
  return (
    <div className="glass-card" style={{
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Corner accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '100px', height: '100px',
        borderRadius: '0 16px 0 100%',
        background: `${accentColor}14`,
        zIndex: 0,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)',
        }}>
          {title}
        </span>
        <div style={{
          background: `${accentColor}18`,
          borderRadius: '10px', padding: '8px',
          border: `1px solid ${accentColor}30`,
        }}>
          <Icon size={16} color={accentColor} />
        </div>
      </div>

      {/* Value */}
      <div style={{ zIndex: 1 }}>
        {loading ? (
          <div style={{
            height: '38px', background: 'var(--surface-high)',
            borderRadius: '8px', width: '55%', animation: 'pulse 1.5s infinite',
          }} />
        ) : (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.025em', lineHeight: 1,
          }}>
            {value}
          </span>
        )}
      </div>

      {sub && (
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: '0.78rem',
          color: 'var(--text-muted)', zIndex: 1,
        }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [days, setDays]       = useState(30);
  const [skip, setSkip]       = useState(0);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'fail' | 'warn'>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, reportsData] = await Promise.all([
        api.getDashboardStats(days),
        api.getReports(0, 100),
      ]);
      setStats(statsData);
      setReports(reportsData);
      setSkip(0);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [days]);

  const s = stats?.summary;
  const pieData = s
    ? [
        { name: 'Compliant', value: s.compliant_count },
        { name: 'Partial',   value: s.partial_count },
        { name: 'Non-Compliant', value: s.non_compliant_count },
      ]
    : [];

  const filteredReports = reports.filter(r => {
    const matchSearch = !search ||
      r.original_filename.toLowerCase().includes(search.toLowerCase()) ||
      String(r.analysis_id).includes(search);
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'pass' && r.compliance_score >= 80) ||
      (filterStatus === 'fail' && r.compliance_score < 50) ||
      (filterStatus === 'warn' && r.compliance_score >= 50 && r.compliance_score < 80);
    return matchSearch && matchStatus;
  });

  const paginatedReports = filteredReports.slice(skip, skip + TABLE_LIMIT);

  /* ── Tooltip style shared ── */
  const tooltipStyle = {
    background: 'rgba(255,255,255,0.97)',
    border: '1px solid var(--border-strong)',
    borderRadius: '10px',
    fontSize: '0.82rem',
    boxShadow: 'var(--shadow-2)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '48px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Enterprise Overview</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 700,
            letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0,
          }}>
            Control Center
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontSize: '0.875rem', margin: '5px 0 0' }}>
            Legal Metrology Compliance — Aggregated Intelligence Dashboard
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="premium-input">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ gap: '7px', padding: '9px 16px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)', borderRadius: '12px',
          color: 'var(--danger)', fontSize: '0.88rem',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontFamily: 'var(--font-body)',
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: '18px' }}>
        <ScoreCard title="Total Audits"     value={s?.total_scans ?? '—'}               icon={Layers}      accentColor="#133820" loading={loading} sub={`Last ${days} days`} />
        <ScoreCard title="Avg Compliance"   value={s ? `${s.avg_compliance_score}%` : '—'} icon={TrendingUp}  accentColor={CHART_GREEN} loading={loading} sub="Global average score" />
        <ScoreCard title="Compliant"        value={s?.compliant_count ?? '—'}            icon={CheckCircle} accentColor={CHART_GREEN} loading={loading} sub="Score ≥ 80%" />
        <ScoreCard title="Non-Compliant"    value={s?.non_compliant_count ?? '—'}        icon={XCircle}     accentColor={CHART_RED}  loading={loading} sub="Score < 50%" />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px' }}>

        {/* Compliance trend */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
            color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '-0.01em',
          }}>
            Compliance Trend
          </h3>
          {loading ? (
            <div style={{ height: '250px', background: 'var(--surface-high)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats?.daily_trend || []}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART_GREEN} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(186,219,162,0.4)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                  tickFormatter={d => d.slice(5)}
                  tickMargin={10} axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                  axisLine={false} tickLine={false} tickMargin={10}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(v: number) => [`${v}%`, 'Avg Score']}
                />
                <Area
                  type="monotone" dataKey="avg_score"
                  stroke={CHART_GREEN} strokeWidth={2.5}
                  fill="url(#scoreGrad)"
                  dot={{ r: 3.5, fill: CHART_GREEN, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: CHART_GREEN, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status donut */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
            color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '-0.01em',
          }}>
            Status Breakdown
          </h3>
          {loading ? (
            <div style={{ flex: 1, background: 'var(--surface-high)', borderRadius: '8px', animation: 'pulse 1.5s infinite', minHeight: '200px' }} />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={62} outerRadius={88}
                  paddingAngle={5} dataKey="value" stroke="none"
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-primary)' }} />
                <Legend
                  formatter={v => (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{v}</span>
                  )}
                  verticalAlign="bottom" height={36} iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Audit History Table ── */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Table controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1.05rem',
              color: 'var(--text-primary)', marginBottom: '3px', letterSpacing: '-0.01em',
            }}>
              Audit History
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Detailed log of all processed compliance scans
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search audits..."
                className="premium-input"
                style={{ paddingLeft: '34px', width: '200px' }}
              />
            </div>

            {/* Filter pills */}
            <div className="tab-container" style={{ padding: '3px', gap: '2px' }}>
              {(['all', 'pass', 'warn', 'fail'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilterStatus(f); setSkip(0); }}
                  className={`tab-button ${filterStatus === f ? 'active' : ''}`}
                  style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Export */}
            <button
              onClick={() => api.downloadAllCSV()}
              className="btn"
              style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
            >
              <Download size={14} style={{ color: '#E3F0A3' }} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="premium-table-container">
          {loading ? (
            <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              <RefreshCw size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px', display: 'block', color: 'var(--accent)' }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>Loading audits…</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              <FileText size={38} style={{ margin: '0 auto 14px', opacity: 0.25, display: 'block' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No audit records match your filters.</p>
            </div>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Filename</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Distribution</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map(r => (
                  <tr key={r.analysis_id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        #{r.analysis_id}
                      </span>
                    </td>
                    <td>
                      <div style={{
                        maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                      }} title={r.original_filename}>
                        {r.original_filename}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td><ScoreBadge score={r.compliance_score} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          display: 'flex', width: '90px', height: '5px',
                          borderRadius: '3px', overflow: 'hidden', background: 'var(--surface-high)',
                        }}>
                          <div style={{ flex: r.passed,  background: CHART_GREEN }} />
                          <div style={{ flex: r.warned,  background: CHART_AMBER }} />
                          <div style={{ flex: r.failed,  background: CHART_RED }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {r.passed}/{r.total_rules}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => api.downloadPDF(r.analysis_id)}
                          title="Download Audit PDF"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '5px' }}
                        >
                          <FileCheck size={13} color="var(--success)" /> Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredReports.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              Showing{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{skip + 1}–{Math.min(skip + TABLE_LIMIT, filteredReports.length)}</strong>
              {' '}of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{filteredReports.length}</strong>
              {' '}audits
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { icon: ChevronLeft, onClick: () => setSkip(Math.max(0, skip - TABLE_LIMIT)), disabled: skip === 0 },
                { icon: ChevronRight, onClick: () => setSkip(skip + TABLE_LIMIT), disabled: skip + TABLE_LIMIT >= filteredReports.length },
              ].map(({ icon: Ic, onClick, disabled }, i) => (
                <button
                  key={i} onClick={onClick} disabled={disabled}
                  className="btn btn-secondary"
                  style={{ padding: '7px 10px', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                >
                  <Ic size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
