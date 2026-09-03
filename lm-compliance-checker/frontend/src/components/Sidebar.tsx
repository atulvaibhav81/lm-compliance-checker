import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, CalculatorIcon,
  DollarSign, Layers, Shield, ChevronLeft, ChevronRight,
  Tag, Activity, X
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isOnline: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scan',      icon: Upload,          label: 'Single Scan' },
  { to: '/batch',     icon: Layers,          label: 'Batch Scan' },
  { to: '/reports',   icon: FileText,        label: 'Audit Reports' },
  { to: '/penalties', icon: DollarSign,      label: 'Penalty Calc' },
  { to: '/usp',       icon: Tag,             label: 'USP Validator' },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, isOnline, mobileMenuOpen, setMobileMenuOpen }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          flex flex-col shrink-0
          h-full bg-white md:border-r border-[rgba(186,219,162,0.7)]
          overflow-y-auto relative z-50
          shadow-[1px_0_12px_rgba(27,42,30,0.04)]
          transition-transform duration-300 ease-in-out md:transition-[width,min-width]
          fixed md:relative top-0 left-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? '64px' : '224px') : '260px',
          minWidth: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? '64px' : '224px') : '260px',
        }}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[rgba(186,219,162,0.55)] min-h-[58px] md:min-h-[74px] bg-[var(--surface-low)]">
          <Link
            to="/"
            className="flex items-center gap-3 shrink-0 no-underline cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            title="Go to Home"
          >
            <img 
              src="/sahi-pack-logo.png" 
              alt="Sahi Pack Logo" 
              className="h-8 md:h-[38px] object-contain shrink-0"
            />
            <div className={`flex-col gap-0.5 md:flex ${collapsed ? 'md:hidden' : 'flex'}`}>
              <span className="font-sans text-lg md:text-xl font-extrabold text-[var(--primary)] tracking-tight leading-none">
                Sahi Pack
              </span>
              <span className="font-sans text-[8px] md:text-[9px] font-bold text-[var(--text-secondary)] tracking-wider uppercase leading-none">
                Compliance
              </span>
            </div>
          </Link>
          <button 
            className="md:hidden p-1 text-[var(--text-muted)] hover:bg-[var(--surface-high)] rounded-md"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 shrink-0
                px-3 py-2.5
                rounded-[10px] no-underline font-[family-name:var(--font-body)]
                text-[0.95rem] md:text-sm whitespace-nowrap relative
                transition-all duration-200
                ${collapsed ? 'md:justify-center' : 'justify-start'}
                ${isActive 
                  ? 'font-bold text-white bg-[var(--primary)] shadow-[0_2px_10px_rgba(19,56,32,0.18)]' 
                  : 'font-medium text-[var(--text-secondary)] bg-transparent hover:bg-[var(--surface-low)]'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    className={`shrink-0 transition-colors ${isActive ? 'text-[var(--on-primary)]' : 'text-[var(--text-muted)]'}`}
                  />
                  <span className={`block ${collapsed ? 'md:hidden' : 'block'}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status + collapse (hidden on mobile) */}
        <div className="hidden md:flex flex-col gap-2.5 p-3.5 border-t border-[rgba(186,219,162,0.55)] bg-[var(--surface-low)] items-start mt-auto">
          {!collapsed && (
            <div className={`flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-body)] font-bold tracking-wider uppercase ${isOnline ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              <Activity size={11} />
              {isOnline ? 'API Online' : 'API Offline'}
            </div>
          )}
          <button
            onClick={onToggle}
            className="bg-[var(--surface-card)] border border-[var(--border-strong)] rounded-lg p-1.5 cursor-pointer text-[var(--text-muted)] flex items-center justify-center transition-colors hover:bg-[var(--surface-high)] hover:border-[var(--border-accent)] w-full"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>
    </>
  );
};
