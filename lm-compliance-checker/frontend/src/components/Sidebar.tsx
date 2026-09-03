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
      className={`
        flex flex-row md:flex-col shrink-0
        w-full md:w-auto h-auto md:h-full
        bg-white border-b md:border-b-0 md:border-r border-[rgba(186,219,162,0.7)]
        overflow-x-auto md:overflow-hidden relative z-10
        shadow-[0_1px_12px_rgba(27,42,30,0.04)] md:shadow-[1px_0_12px_rgba(27,42,30,0.04)]
        transition-[width,min-width] duration-300
      `}
      style={{
        width: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? '64px' : '224px') : '100%',
        minWidth: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? '64px' : '224px') : '100%',
      }}
    >
      {/* Brand — clicks navigate to Home */}
      <Link
        to="/"
        className={`
          flex items-center gap-3 shrink-0
          px-4 md:px-4 py-3 md:py-4
          border-r md:border-r-0 md:border-b border-[rgba(186,219,162,0.55)]
          min-w-[120px] md:min-h-[74px] md:min-w-0
          justify-center md:justify-start
          bg-[var(--surface-low)] no-underline cursor-pointer
          hover:opacity-80 transition-opacity
        `}
        title="Go to Home"
      >
        <img 
          src="/sahi-pack-logo.png" 
          alt="Sahi Pack Logo" 
          className="h-8 md:h-[38px] object-contain shrink-0 transition-transform"
        />
        <div className={`flex-col gap-0.5 md:flex hidden ${collapsed ? 'md:hidden' : ''}`}>
          <span className="font-sans text-lg md:text-xl font-extrabold text-[var(--primary)] tracking-tight leading-none">
            Sahi Pack
          </span>
          <span className="font-sans text-[8px] md:text-[9px] font-bold text-[var(--text-secondary)] tracking-wider uppercase leading-none">
            Compliance
          </span>
        </div>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-row md:flex-col gap-1 md:gap-0.5 p-2 flex-1 md:flex-none">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-2 md:gap-2.5 shrink-0
              px-3 py-2 md:px-3 md:py-2.5
              justify-center md:justify-start
              rounded-lg md:rounded-[10px] no-underline font-[family-name:var(--font-body)]
              text-sm whitespace-nowrap relative
              transition-all duration-200
              ${isActive 
                ? 'font-bold text-white bg-[var(--primary)] shadow-[0_2px_10px_rgba(19,56,32,0.18)]' 
                : 'font-medium text-[var(--text-secondary)] bg-transparent hover:bg-[var(--surface-low)]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  className={`shrink-0 transition-colors ${isActive ? 'text-[var(--on-primary)]' : 'text-[var(--text-muted)]'}`}
                />
                <span className={`block md:hidden ${collapsed ? '' : 'md:block'}`}>
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
  );
};
