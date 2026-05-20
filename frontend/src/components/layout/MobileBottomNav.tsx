import { NavLink } from 'react-router-dom';
import { LayoutDashboard, SlidersHorizontal, Star, Target, Settings } from 'lucide-react';

const items = [
  { path: '/app/dashboard', label: 'Home',      icon: LayoutDashboard   },
  { path: '/app/screener',  label: 'Screener',  icon: SlidersHorizontal },
  { path: '/app/watchlist', label: 'Watchlist', icon: Star              },
  { path: '/app/goals',     label: 'Goals',     icon: Target            },
  { path: '/app/settings',  label: 'Account',   icon: Settings          },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav">
      {items.map((item) => (
        <NavLink key={item.path} to={item.path}
          className={({ isActive }) => `mobile-bottom-link${isActive ? ' active' : ''}`}>
          <item.icon size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
