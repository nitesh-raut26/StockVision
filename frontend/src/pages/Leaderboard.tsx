import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, UserPlus, Star } from 'lucide-react';
import { mockLeaderboard } from '../data/mockData';
import { fetchLeaderboard } from '../lib/api';
import { useStore } from '../store/useStore';
import { useIsMobile } from '../hooks/useBreakpoint';
import Pagination from '../components/ui/Pagination';

const PER_PAGE = 10;

const recentTrades = [
  { user: 'Bull_7829',    stock: 'IDEAFORGE',  action: 'BUY',  size: '~₹2.4L', time: '2h ago' },
  { user: 'Alpha_4421',   stock: 'HAL',        action: 'BUY',  size: '~₹8.1L', time: '4h ago' },
  { user: 'DeepValue_92', stock: 'TCS',        action: 'SELL', size: '~₹12.3L', time: '6h ago' },
  { user: 'Momentum_18',  stock: 'BAJFINANCE', action: 'BUY',  size: '~₹3.8L', time: '8h ago' },
];

const medalStyle = (rank: number) => {
  if (rank === 1) return { bg: '#B8860B', color: '#fff', label: '1' };
  if (rank === 2) return { bg: '#708090', color: '#fff', label: '2' };
  if (rank === 3) return { bg: '#8B5E3C', color: '#fff', label: '3' };
  return { bg: 'rgba(255,255,255,0.07)', color: 'var(--tx-3)', label: `${rank}` };
};

export default function Leaderboard() {
  const { authToken } = useStore();
  const isMobile = useIsMobile();
  const [followed, setFollowed] = useState<string[]>([]);
  const [showAlert, setShowAlert] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', authToken],
    queryFn: () => fetchLeaderboard(authToken),
  });
  const leaderboard = leaderboardQuery.data ?? mockLeaderboard;
  const rows = leaderboard.filter(l => !l.isUser);
  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleFollow = (user: string) => {
    setFollowed(prev => prev.includes(user) ? prev.filter(u => u !== user) : [...prev, user]);
    if (!followed.includes(user)) { setShowAlert(user); setTimeout(() => setShowAlert(null), 3000); }
  };

  const userEntry = leaderboard.find(l => l.isUser);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Investor Leaderboard</h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>
          Top investors ranked by returns. All usernames are pseudonymous.
          <span style={{ color: authToken ? 'var(--gain)' : 'var(--gold)', marginLeft: 8 }}>
            {authToken ? 'Live API' : 'Demo mode'}
          </span>
        </p>
      </div>

      {showAlert && (
        <div style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: 'var(--r-md)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gain)', fontSize: 13.5, fontWeight: 500 }}>
          <Bell size={15} />
          You will now receive trade alerts when <strong style={{ marginLeft: 4 }}>{showAlert}</strong> makes a trade.
        </div>
      )}

      {/* Your rank */}
      {userEntry && (
        <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(244,117,32,0.15) 0%, rgba(167,139,250,0.08) 100%)', borderColor: 'rgba(244,117,32,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, background: 'var(--brand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>N</div>
              <div>
                <p style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--tx)' }}>{userEntry.username}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600 }}>Rank #{userEntry.rank}</span>
                  <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>Top {100 - userEntry.percentile}% of all investors</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 4 }}>Your XIRR</p>
              <p className="num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gain)' }}>{userEntry.xirr}%</p>
              <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>₹{(userEntry.portfolioValue / 100000).toFixed(1)}L portfolio</p>
            </div>
          </div>
          <div style={{ marginTop: 18, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${userEntry.percentile}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand), var(--purple))', borderRadius: 99 }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20 }}>
        {/* Leaderboard table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Top 100 by XIRR</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Investor</th>
                <th style={{ textAlign: 'right' }}>Portfolio</th>
                <th style={{ textAlign: 'right' }}>XIRR</th>
                <th style={{ textAlign: 'right' }}>Followers</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((inv, i) => {
                const m = medalStyle(inv.rank);
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: m.color }}>
                        {m.label}
                      </div>
                    </td>
                    <td style={{ color: 'var(--tx)', fontWeight: 600 }}>{inv.username}</td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>₹{(inv.portfolioValue/100000).toFixed(1)}L</td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--gain)', fontWeight: 700 }}>{inv.xirr}%</td>
                    <td className="num" style={{ textAlign: 'right', color: 'var(--tx-3)', fontSize: 12 }}>{inv.followers}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => toggleFollow(inv.username)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: followed.includes(inv.username) ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: followed.includes(inv.username) ? 'var(--brand-dim)' : 'transparent', color: followed.includes(inv.username) ? 'var(--brand)' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap' }}>
                        {followed.includes(inv.username) ? <Bell size={11} fill="currentColor" /> : <UserPlus size={11} />}
                        {followed.includes(inv.username) ? 'Following' : 'Follow'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)' }}>
            <Pagination page={page} totalPages={totalPages} onPageChange={p => { setPage(p); }} totalItems={rows.length} perPage={PER_PAGE} />
          </div>
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Bell size={15} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Live Copy Alerts</h3>
              <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--gain)' }} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', marginBottom: 14, lineHeight: 1.6 }}>Real-time alerts when investors you follow make trades.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentTrades.map((t, i) => (
                <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>{t.user}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{t.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: t.action === 'BUY' ? 'rgba(0,200,150,0.12)' : 'rgba(255,77,106,0.12)', color: t.action === 'BUY' ? 'var(--gain)' : 'var(--loss)' }}>{t.action}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--tx-2)', fontWeight: 600 }}>{t.stock}</span>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{t.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Star size={15} color="var(--gold)" />
              <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Legal Notice</h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.7 }}>Copy alerts notify you of another user's trade activity — not SEBI-registered investment advice. Past XIRR does not guarantee future returns.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
