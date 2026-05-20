import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar, { TOPBAR_H } from './TopBar';
import MobileBottomNav from './MobileBottomNav';
import CookieConsent from '../ui/CookieConsent';
import { useStore } from '../../store/useStore';
import { useIsMobile } from '../../hooks/useBreakpoint';

export default function AppLayout() {
  const { sidebarOpen } = useStore();
  const isMobile = useIsMobile();
  const sidebarW = isMobile ? 0 : (sidebarOpen ? 240 : 60);
  const topbarH  = isMobile ? TOPBAR_H.mobile : TOPBAR_H.desktop;

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, marginLeft: sidebarW, transition: 'margin-left 220ms cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column', minHeight: '100dvh', overflow: 'hidden' }}>
        <TopBar />
        <main style={{
          flex: 1,
          padding: isMobile ? `20px 16px 100px` : '28px 28px',
          marginTop: topbarH,
          minHeight: 0,
        }}>
          <Outlet />
        </main>
        {isMobile && <MobileBottomNav />}
      </div>
      {/* DPDP Act 2023 cookie/consent banner — shown once per 180 days */}
      <CookieConsent />
    </div>
  );
}
