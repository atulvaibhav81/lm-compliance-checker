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
    <div className="glass-card flex flex-col gap-2.5 p-5 relative overflow-hidden">
      {/* Corner accent glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full z-0" style={{ background: `${accentColor}14` }} />

      {/* Header row */}
      <div className="flex justify-between items-start z-10">
        <span className="font-[family-name:var(--font-body)] text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {title}
        </span>
        <div className="p-2 rounded-lg border" style={{ background: `${accentColor}18`, borderColor: `${accentColor}30` }}>
          <Icon size={16} color={accentColor} />
        </div>
      </div>

      {/* Value */}
      <div className="z-10 mt-1">
        {loading ? (
          <div className="h-9 bg-[var(--surface-high)] rounded-lg w-1/2 animate-pulse" />
        ) : (
          <span className="font-[family-name:var(--font-display)] text-3xl md:text-[2.1rem] font-bold text-[var(--text-primary)] tracking-tight leading-none">
            {value}
          </span>
        )}
      </div>

      {sub && (
        <span className="font-[family-name:var(--font-body)] text-[0.78rem] text-[var(--text-muted)] z-10">
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
    <div className="page-enter flex flex-col gap-7 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="section-label mb-1.5">Enterprise Overview</div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] m-0">
            Control Center
          </h1>
          <p className="font-[family-name:var(--font-body)] text-[var(--text-muted)] text-xs md:text-[0.875rem] mt-1 mb-0">
            Legal Metrology Compliance — Aggregated Intelligence Dashboard
          </p>
        </div>
        <div className="flex gap-2.5 items-center w-full sm:w-auto">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="premium-input flex-1 sm:flex-none">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={loadData}
            className="btn btn-secondary px-4 py-2 text-sm gap-2 whitespace-nowrap"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl text-[var(--danger)] text-sm flex items-center gap-2 font-[family-name:var(--font-body)]">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5">
        <ScoreCard title="Total Audits"     value={s?.total_scans ?? '—'}               icon={Layers}      accentColor="#133820" loading={loading} sub={`Last ${days} days`} />
        <ScoreCard title="Avg Compliance"   value={s ? `${s.avg_compliance_score}%` : '—'} icon={TrendingUp}  accentColor={CHART_GREEN} loading={loading} sub="Global average score" />
        <ScoreCard title="Compliant"        value={s?.compliant_count ?? '—'}            icon={CheckCircle} accentColor={CHART_GREEN} loading={loading} sub="Score ≥ 80%" />
        <ScoreCard title="Non-Compliant"    value={s?.non_compliant_count ?? '—'}        icon={XCircle}     accentColor={CHART_RED}  loading={loading} sub="Score < 50%" />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5">

        {/* Compliance trend */}
        <div className="glass-card lg:col-span-2 p-5 md:p-6">
          <h3 className="font-[family-name:var(--font-body)] font-bold text-base text-[var(--text-primary)] mb-5 tracking-tight">
            Compliance Trend
          </h3>
          {loading ? (
            <div className="h-[250px] bg-[var(--surface-high)] rounded-lg animate-pulse" />
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
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                  tickFormatter={d => window.innerWidth < 640 ? '' : d.slice(5)}
                  tickMargin={10} axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
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
                  dot={{ r: 3, fill: CHART_GREEN, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: CHART_GREEN, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status donut */}
        <div className="glass-card p-5 md:p-6 flex flex-col">
          <h3 className="font-[family-name:var(--font-body)] font-bold text-base text-[var(--text-primary)] mb-5 tracking-tight">
            Status Breakdown
          </h3>
          {loading ? (
            <div className="flex-1 bg-[var(--surface-high)] rounded-lg animate-pulse min-h-[200px]" />
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
                    <span className="text-xs text-[var(--text-secondary)] font-[family-name:var(--font-body)] font-medium ml-1">{v}</span>
                  )}
                  verticalAlign="bottom" height={36} iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Audit History Table ── */}
      <div className="glass-card p-5 md:p-6 flex flex-col gap-5 overflow-hidden">

        {/* Table controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h3 className="font-[family-name:var(--font-body)] font-bold text-[1.05rem] text-[var(--text-primary)] mb-1 tracking-tight">
              Audit History
            </h3>
            <p className="font-[family-name:var(--font-body)] text-xs text-[var(--text-muted)] m-0">
              Detailed log of all processed compliance scans
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center w-full xl:w-auto">
            {/* Search */}
            <div className="relative flex-1 xl:flex-none">
              <Search size={14} color="var(--text-muted)" className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search audits..."
                className="premium-input pl-8 w-full xl:w-48"
              />
            </div>

            {/* Filter pills */}
            <div className="tab-container p-1 gap-0.5 overflow-x-auto hidden sm:flex">
              {(['all', 'pass', 'warn', 'fail'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilterStatus(f); setSkip(0); }}
                  className={`tab-button px-3 py-1.5 text-xs ${filterStatus === f ? 'active' : ''}`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Export */}
            <button
              onClick={() => api.downloadAllCSV()}
              className="btn px-4 py-2 text-sm gap-1.5 sm:ml-auto xl:ml-0"
            >
              <Download size={14} className="text-[#E3F0A3]" /> <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="premium-table-container overflow-x-auto w-full">
          {loading ? (
            <div className="p-14 text-center text-[var(--text-muted)] font-[family-name:var(--font-body)]">
              <RefreshCw size={26} className="animate-spin mx-auto mb-3.5 block text-[var(--accent)]" />
              <p className="m-0 text-sm">Loading audits…</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-14 text-center text-[var(--text-muted)] font-[family-name:var(--font-body)]">
              <FileText size={38} className="mx-auto mb-3.5 opacity-25 block" />
              <p className="m-0 text-sm">No audit records match your filters.</p>
            </div>
          ) : (
            <table className="premium-table min-w-[700px]">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Filename</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Distribution</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map(r => (
                  <tr key={r.analysis_id}>
                    <td>
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-muted)] font-semibold">
                        #{r.analysis_id}
                      </span>
                    </td>
                    <td>
                      <div className="max-w-[200px] md:max-w-[240px] truncate font-semibold text-[var(--text-primary)] font-[family-name:var(--font-body)] text-sm" title={r.original_filename}>
                        {r.original_filename}
                      </div>
                    </td>
                    <td className="font-[family-name:var(--font-body)] text-xs text-[var(--text-muted)]">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td><ScoreBadge score={r.compliance_score} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex w-20 md:w-[90px] h-1.5 rounded-sm overflow-hidden bg-[var(--surface-high)]">
                          <div style={{ flex: r.passed,  background: CHART_GREEN }} />
                          <div style={{ flex: r.warned,  background: CHART_AMBER }} />
                          <div style={{ flex: r.failed,  background: CHART_RED }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-[family-name:var(--font-mono)] font-semibold">
                          {r.passed}/{r.total_rules}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => api.downloadPDF(r.analysis_id)}
                          title="Download Audit PDF"
                          className="btn btn-secondary px-2.5 py-1.5 text-xs gap-1"
                        >
                          <FileCheck size={13} className="text-[var(--success)]" /> <span className="hidden sm:inline">Report</span>
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
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] font-[family-name:var(--font-body)]">
              Showing{' '}
              <strong className="text-[var(--text-primary)]">{skip + 1}–{Math.min(skip + TABLE_LIMIT, filteredReports.length)}</strong>
              {' '}of{' '}
              <strong className="text-[var(--text-primary)]">{filteredReports.length}</strong>
              {' '}audits
            </span>
            <div className="flex gap-2">
              {[
                { icon: ChevronLeft, onClick: () => setSkip(Math.max(0, skip - TABLE_LIMIT)), disabled: skip === 0 },
                { icon: ChevronRight, onClick: () => setSkip(skip + TABLE_LIMIT), disabled: skip + TABLE_LIMIT >= filteredReports.length },
              ].map(({ icon: Ic, onClick, disabled }, i) => (
                <button
                  key={i} onClick={onClick} disabled={disabled}
                  className={`btn btn-secondary px-2.5 py-1.5 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
