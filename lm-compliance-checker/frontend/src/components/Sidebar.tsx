import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, CalculatorIcon,
  DollarSign, Layers, Shield, ChevronLeft, ChevronRight,
  Tag, Activity
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isOnline: boolean;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scan',      icon: Upload,          label: 'Single Scan' },
  { to: '/batch',     icon: Layers,          label: 'Batch Scan' },
  { to: '/reports',   icon: FileText,        label: 'Audit Reports' },
  { to: '/penalties', icon: DollarSign,      label: 'Penalty Calc' },
  { to: '/usp',       icon: Tag,             label: 'USP Validator' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, isOnline }) => {
  return (
    <aside
      style={{
        width: collapsed ? '64px' : '224px',
        minWidth: collapsed ? '64px' : '224px',
        background: '#ffffff',
        borderRight: '1px solid rgba(186,219,162,0.7)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
        boxShadow: '1px 0 12px rgba(27,42,30,0.04)',
      }}
    >
      {/* Brand — clicks navigate to Home */}
      <Link
        to="/"
        style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid rgba(186,219,162,0.55)',
          minHeight: '74px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'var(--surface-low)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'opacity 0.18s cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        title="Go to Home"
      >
        <img 
          src="/sahi-pack-logo.png" 
          alt="Sahi Pack Logo" 
          style={{ 
            height: '38px', 
            objectFit: 'contain', 
            transition: 'transform 0.18s',
            flexShrink: 0
          }} 
        />
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              Sahi Pack
            </span>
            <span style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              Legal Metrology Compliance Platform
            </span>
          </div>
        )}
      </Link>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '11px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '10px',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#ffffff' : 'var(--text-secondary)',
              background: isActive ? 'var(--primary)' : 'transparent',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
              whiteSpace: 'nowrap',
              position: 'relative',
              boxShadow: isActive ? '0 2px 10px rgba(19,56,32,0.18)' : 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  style={{
                    flexShrink: 0,
                    color: isActive ? '#E3F0A3' : 'var(--text-muted)',
                    transition: 'color 0.18s',
                  }}
                />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Status + collapse */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 16px',
        borderTop: '1px solid rgba(186,219,162,0.55)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: collapsed ? 'center' : 'flex-start',
        background: 'var(--surface-low)',
      }}>
        {!collapsed && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '11px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: isOnline ? 'var(--success)' : 'var(--danger)',
          }}>
            <Activity size={11} />
            {isOnline ? 'API Online' : 'API Offline'}
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            padding: '6px 8px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-high)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-card)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
};
