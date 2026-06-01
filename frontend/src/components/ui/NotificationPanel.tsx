import { useState } from 'react';
import { Bell, TrendingUp, AlertTriangle, Gift, Info, Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { TOPBAR_H } from '../layout/TopBar';

type NotifType = 'price' | 'alert' | 'promo' | 'system';

interface Notif {
  id: number;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFS: Notif[] = [
  { id: 1, type: 'price',  title: 'RELIANCE hit target',      body: 'RELIANCE crossed ₹2,920 (+1.8%). Your target price alert triggered.',              time: '5m ago',  read: false },
  { id: 2, type: 'alert',  title: 'Portfolio alert',          body: 'HAL down 2.3% today. Review your stop-loss at ₹3,900.',                             time: '32m ago', read: false },
  { id: 3, type: 'promo',  title: 'Refer & Earn ₹500',        body: 'Invite a friend to StockVision and earn ₹500 in credits. Share your link now.',     time: '2h ago',  read: false },
  { id: 4, type: 'system', title: 'New: IPO direct apply',    body: 'Apply for IPOs via connected brokers in one click. Explore IPO Tracker.',           time: '1d ago',  read: true  },
  { id: 5, type: 'price',  title: 'BEL +4.2% today',          body: 'BEL surging on defence contract news. Current price: ₹298.',                        time: '2d ago',  read: true  },
  { id: 6, type: 'alert',  title: 'Market opens in 15 min',   body: 'NSE & BSE open at 9:15 AM. Your watchlist has 3 stocks with pending triggers.',      time: '2d ago',  read: true  },
];

const TYPE_COLOR: Record<NotifType, string> = {
  price:  'var(--gain)',
  alert:  'var(--loss)',
  promo:  'var(--brand)',
  system: 'var(--tx-3)',
};

function TypeIcon({ type }: { type: NotifType }) {
  const color = TYPE_COLOR[type];
  if (type === 'price')  return <TrendingUp size={14} color={color} />;
  if (type === 'alert')  return <AlertTriangle size={14} color={color} />;
  if (type === 'promo')  return <Gift size={14} color={color} />;
  return <Info size={14} color={color} />;
}

export default function NotificationPanel() {
  const [open, setOpen]   = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const isMobile = useIsMobile();

  const unread      = notifs.filter(n => !n.read).length;
  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));
  const dismiss     = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifs(ns => ns.filter(n => n.id !== id));
  };
  const markRead = (id: number) => setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-card)',
          border: `1px solid ${open ? 'rgba(244,117,32,0.5)' : 'var(--border)'}`,
          color: open ? 'var(--brand)' : 'var(--tx-2)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'border-color 150ms, color 150ms',
        }}>
        <Bell size={15} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 7, height: 7,
            background: 'var(--loss)',
            borderRadius: '50%',
            border: '1.5px solid var(--bg-surface)',
            display: 'block',
          }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              style={isMobile ? {
                position: 'fixed',
                top: TOPBAR_H.mobile + 6,
                left: 8,
                right: 8,
                width: 'auto',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                zIndex: 200,
                overflow: 'hidden',
              } : {
                position: 'absolute', top: 42, right: 0,
                width: 368,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                zIndex: 200,
                overflow: 'hidden',
              }}>

              {/* Header */}
              <div style={{
                padding: '13px 16px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      background: 'var(--loss)', color: '#fff',
                      borderRadius: 99, padding: '1px 7px',
                    }}>
                      {unread}
                    </span>
                  )}
                </div>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11.5, color: 'var(--brand)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '3px 8px', borderRadius: 6,
                    }}>
                    <Check size={11} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: 390, overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                    All caught up!
                  </div>
                ) : notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', gap: 11,
                      cursor: 'pointer',
                      background: n.read ? 'transparent' : 'rgba(244,117,32,0.04)',
                      transition: 'background 120ms',
                    }}>
                    {/* Type icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 1,
                      background: `${TYPE_COLOR[n.type]}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <TypeIcon type={n.type} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 700, color: 'var(--tx)', lineHeight: 1.3 }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--tx-3)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
                          {n.time}
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--tx-3)', lineHeight: 1.55, margin: 0 }}>
                        {n.body}
                      </p>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={e => dismiss(n.id, e)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--tx-3)', flexShrink: 0,
                        alignSelf: 'flex-start', padding: '2px 3px', borderRadius: 4,
                        marginTop: 2,
                      }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button style={{
                  fontSize: 12, color: 'var(--brand)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}>
                  View all notifications
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
