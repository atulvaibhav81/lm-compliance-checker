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
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
          isOnline={isOnline}
        />

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top bar */}
          <header style={{
            height: '58px',
            borderBottom: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            background: 'rgba(244,251,243,0.92)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            flexShrink: 0,
            boxShadow: '0 1px 0 var(--border)',
          }}>
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Legal Metrology (Packaged Commodities) Rules, 2011
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* API status badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 12px',
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-primary)',
              }}>
                {/* Pinging dot */}
                <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
                  {isOnline && (
                    <span style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      opacity: 0.7,
                      animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
                    }} />
                  )}
                  <span style={{
                    position: 'relative',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isOnline ? 'var(--accent)' : 'var(--danger)',
                    boxShadow: isOnline
                      ? '0 0 0 2px rgba(66,214,116,0.3)'
                      : '0 0 0 2px var(--danger-border)',
                  }} />
                </span>
                <span style={{ color: isOnline ? 'var(--success)' : 'var(--danger)' }}>
                  {isOnline ? 'API Online' : 'API Offline'}
                </span>
              </div>

              {/* Version chip */}
              <span style={{
                padding: '4px 10px',
                background: 'var(--tint-cream)',
                border: '1px solid var(--tint-sage)',
                borderRadius: 'var(--radius-full)',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                v2.0.0
              </span>
            </div>
          </header>

          {/* Page content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
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
