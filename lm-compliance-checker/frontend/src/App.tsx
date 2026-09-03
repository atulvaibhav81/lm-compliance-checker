import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import SingleScan from './pages/SingleScan';
import BatchScan from './pages/BatchScan';
import AuditReports from './pages/AuditReports';
import PenaltyCalculator from './pages/PenaltyCalculator';
import USPValidator from './pages/USPValidator';
import { api } from './services/api';
import { Menu } from 'lucide-react';
import './index.css';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const check = async () => setIsOnline(await api.checkHealth());
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="flex w-full min-h-screen h-screen overflow-hidden bg-[var(--surface)] relative">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
          isOnline={isOnline}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
          {/* Top bar */}
          <header className="h-[58px] border-b border-[var(--border-strong)] flex items-center justify-between px-3 md:px-7 bg-[rgba(244,251,243,0.92)] backdrop-blur-md shrink-0 shadow-[0_1px_0_var(--border)] relative z-10 w-full">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 rounded-md hover:bg-[var(--surface-high)] text-[var(--text-primary)]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <Menu size={20} />
              </button>
              <div className="font-[family-name:var(--font-body)] text-[10px] md:text-xs font-bold text-[var(--text-muted)] tracking-wider uppercase truncate">
                LMPC 2011
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
              {/* API status badge */}
              <div className="inline-flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 bg-white/90 border border-[var(--border-strong)] rounded-full text-[9px] md:text-[11px] font-bold tracking-wider uppercase font-[family-name:var(--font-body)] text-[var(--text-primary)]">
                {/* Pinging dot */}
                <span className="relative inline-flex w-2 h-2 shrink-0">
                  {isOnline && (
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-70 animate-ping" />
                  )}
                  <span
                    className={`relative w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--accent)] shadow-[0_0_0_2px_rgba(66,214,116,0.3)]' : 'bg-[var(--danger)] shadow-[0_0_0_2px_var(--danger-border)]'}`}
                  />
                </span>
                <span className={isOnline ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Version chip */}
              <span className="px-1.5 md:px-2.5 py-1 bg-[var(--tint-cream)] border border-[var(--tint-sage)] rounded-full text-[9px] md:text-[10px] font-bold text-[var(--primary)] font-[family-name:var(--font-body)] tracking-wide uppercase shrink-0">
                v2.0
              </span>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-7 lg:p-8 w-full">
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
