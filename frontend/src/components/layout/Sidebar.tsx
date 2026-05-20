import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, SlidersHorizontal, TrendingUp, BarChart3, GitCompare,
  Wallet, Map, Target, Receipt, Trophy, BookOpen, Users, Briefcase,
  Settings, ChevronLeft, ChevronRight, LogOut, BarChart2, Star,
  Layers, Rocket, History, Gift, Brain,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useIsMobile } from '../../hooks/useBreakpoint';
import ReferralModal from '../ui/ReferralModal';

const navGroups = [
  {
    label: 'Main',
    items: [
      { path: '/app/dashboard',     icon: LayoutDashboard,  label: 'Dashboard'     },
      { path: '/app/screener',      icon: SlidersHorizontal,label: 'Stock Screener'},
    ],
  },
  {
    label: 'Analysis',
    items: [
      { path: '/app/ai',              icon: Brain,       label: 'AI Assistant'    },
      { path: '/app/stock/HAL',       icon: TrendingUp,  label: 'Stock Detail'    },
      { path: '/app/dcf/RELIANCE',    icon: BarChart3,   label: 'DCF Builder'     },
      { path: '/app/comps/RELIANCE',  icon: GitCompare,  label: 'Comps Analysis'  },
      { path: '/app/options',         icon: Layers,      label: 'Options Chain'   },
      { path: '/app/ipo',             icon: Rocket,      label: 'IPO Tracker'     },
      { path: '/app/backtest',        icon: History,     label: 'Backtesting'     },
    ],
  },
  {
    label: 'Portfolio',
    items: [
      { path: '/app/watchlist',    icon: Star,    label: 'Watchlist'     },
      { path: '/app/mutual-funds', icon: Wallet,  label: 'Mutual Funds'  },
      { path: '/app/heatmap',      icon: Map,     label: 'Market Heatmap'},
      { path: '/app/goals',        icon: Target,  label: 'Goal Planner'  },
      { path: '/app/tax',          icon: Receipt, label: 'Tax & P&L'     },
    ],
  },
  {
    label: 'Community',
    items: [
      { path: '/app/leaderboard', icon: Trophy,   label: 'Leaderboard'       },
      { path: '/app/research',    icon: BookOpen, label: 'Research Library'  },
      { path: '/app/family',      icon: Users,    label: 'Family Portfolio'  },
    ],
  },
  {
    label: 'B2B',
    items: [
      { path: '/app/ca-portal', icon: Briefcase, label: 'CA Portal' },
    ],
  },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen, logout, user } = useStore();
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const [referralOpen, setReferralOpen] = useState(false);
  const w = isMobile ? 288 : (sidebarOpen ? 240 : 60);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <button type="button" aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', zIndex: 39, cursor: 'default' }} />
      )}

      <aside style={{
        width: w,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: isMobile ? 'transform 220ms cubic-bezier(.4,0,.2,1)' : 'width 220ms cubic-bezier(.4,0,.2,1)',
        transform: isMobile ? `translateX(${sidebarOpen ? '0' : '-100%'})` : 'translateX(0)',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'fixed',
        top: isMobile ? 84 : 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
        boxShadow: isMobile && sidebarOpen ? 'var(--shadow-elevated)' : undefined,
      }}>

        {/* Logo row — desktop only (mobile topbar already shows identity) */}
        {!isMobile && <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          padding: sidebarOpen ? '0 14px 0 16px' : '0',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, background: 'var(--brand)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px rgba(244,117,32,0.35)' }}>
                <BarChart2 size={14} color="white" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: '-0.025em', color: 'var(--tx)', whiteSpace: 'nowrap' }}>StockVision</span>
            </div>
          )}
          <button onClick={toggleSidebar}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7,
              background: 'var(--surface-mid)',
              border: '1px solid var(--border)',
              color: 'var(--tx-2)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 150ms',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-mid)')}>
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>}

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {(sidebarOpen || isMobile) && (
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx-3)', padding: '10px 8px 6px', whiteSpace: 'nowrap' }}>
                  {group.label}
                </p>
              )}
              {!sidebarOpen && !isMobile && <div style={{ height: 6 }} />}
              {group.items.map(item => (
                <NavLink key={item.path} to={item.path}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  title={!sidebarOpen && !isMobile ? item.label : undefined}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  style={{
                    marginBottom: 2,
                    justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
                    padding: (sidebarOpen || isMobile) ? '9px 12px' : '9px 0',
                    borderRadius: 'var(--r-sm)',
                  }}>
                  <item.icon size={16} style={{ flexShrink: 0 }} />
                  {(sidebarOpen || isMobile) && <span style={{ whiteSpace: 'nowrap', fontSize: 13.5 }}>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: settings + logout + user */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 8px', flexShrink: 0 }}>
          {/* Refer & Earn */}
          <button
            onClick={() => setReferralOpen(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: (sidebarOpen || isMobile) ? '9px 12px' : '9px 0',
              borderRadius: 'var(--r-sm)', border: 'none',
              background: sidebarOpen || isMobile ? 'rgba(244,117,32,0.08)' : 'transparent',
              color: 'var(--brand)', cursor: 'pointer', marginBottom: 4,
              justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
              fontFamily: 'inherit',
            }}>
            <Gift size={16} style={{ flexShrink: 0 }} />
            {(sidebarOpen || isMobile) && <span style={{ fontSize: 13.5, fontWeight: 600 }}>Refer & Earn</span>}
          </button>

          <NavLink to="/app/settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => isMobile && setSidebarOpen(false)}
            style={{ marginBottom: 4, justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center', borderRadius: 'var(--r-sm)' }}>
            <Settings size={16} style={{ flexShrink: 0 }} />
            {(sidebarOpen || isMobile) && <span style={{ fontSize: 13.5 }}>Settings</span>}
          </NavLink>

          <button onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: (sidebarOpen || isMobile) ? '9px 12px' : '9px 0',
              borderRadius: 'var(--r-sm)',
              border: 'none', background: 'transparent', color: 'var(--tx-3)',
              cursor: 'pointer', transition: 'background 120ms, color 120ms',
              justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
              fontFamily: 'inherit', fontSize: 13.5,
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(211,47,47,0.08)'; (e.currentTarget).style.color = 'var(--loss)'; }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--tx-3)'; }}>
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {(sidebarOpen || isMobile) && <span style={{ whiteSpace: 'nowrap' }}>Sign out</span>}
          </button>

          {/* User chip */}
          {(sidebarOpen || isMobile) && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 4px', marginTop: 4, borderTop: '1px solid var(--border)' }}>
              <div style={{ width: 30, height: 30, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
                {user.name?.[0] ?? 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'capitalize' }}>{user.plan} plan</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <ReferralModal open={referralOpen} onClose={() => setReferralOpen(false)} />
    </>
  );
}
