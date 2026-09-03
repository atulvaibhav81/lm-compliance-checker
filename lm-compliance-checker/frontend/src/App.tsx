import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SingleScan from './pages/SingleScan';
import BatchScan from './pages/BatchScan';
import AuditReports from './pages/AuditReports';
import PenaltyCalculator from './pages/PenaltyCalculator';
import USPValidator from './pages/USPValidator';
import { api } from './services/api';
import './index.css';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const check = async () => setIsOnline(await api.checkHealth());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[var(--surface)]">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
          isOnline={isOnline}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-[58px] border-b border-[var(--border-strong)] flex items-center justify-between px-4 md:px-7 bg-[rgba(244,251,243,0.92)] backdrop-blur-md shrink-0 shadow-[0_1px_0_var(--border)]">
            <div className="font-[family-name:var(--font-body)] text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase truncate max-w-[50%] md:max-w-none">
              Legal Metrology Rules, 2011
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* API status badge */}
              <div className="inline-flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 bg-white/90 border border-[var(--border-strong)] rounded-full text-[9px] md:text-[11px] font-bold tracking-wider uppercase font-[family-name:var(--font-body)] text-[var(--text-primary)]">
                {/* Pinging dot */}
                <span className="relative inline-flex w-2 h-2">
                  {isOnline && (
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-70 animate-ping" />
                  )}
                  <span
                    className={`relative w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--accent)] shadow-[0_0_0_2px_rgba(66,214,116,0.3)]' : 'bg-[var(--danger)] shadow-[0_0_0_2px_var(--danger-border)]'}`}
                  />
                </span>
                <span className={isOnline ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                  {isOnline ? 'API Online' : 'API Offline'}
                </span>
              </div>

              {/* Version chip */}
              <span className="px-2 md:px-2.5 py-1 bg-[var(--tint-cream)] border border-[var(--tint-sage)] rounded-full text-[9px] md:text-[10px] font-bold text-[var(--primary)] font-[family-name:var(--font-body)] tracking-wide uppercase">
                v2.0.0
              </span>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-7 lg:p-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scan" element={<SingleScan />} />
              <Route path="/batch" element={<BatchScan />} />
              <Route path="/reports" element={<AuditReports />} />
              <Route path="/penalties" element={<PenaltyCalculator />} />
              <Route path="/usp" element={<USPValidator />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
