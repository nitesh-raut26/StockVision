import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, Star, AlertTriangle, Zap, Search, X, ChevronDown } from 'lucide-react';
import Pagination from '../components/ui/Pagination';

const PER_PAGE = 10;
import { useStore } from '../store/useStore';
import { fetchWatchlist, fetchAlerts, addToWatchlist, removeFromWatchlist, createAlert, deleteAlert } from '../lib/api';
import { useIsMobile } from '../hooks/useBreakpoint';
import Dropdown from '../components/ui/Dropdown';

const CONDITIONS = [
  { value: 'above',      label: 'Price above ₹' },
  { value: 'below',      label: 'Price below ₹' },
  { value: 'pct_change', label: '% move (abs)' },
];

const conditionLabel = (cond: string, threshold: number) => {
  if (cond === 'above') return `≥ ₹${threshold.toLocaleString('en-IN')}`;
  if (cond === 'below') return `≤ ₹${threshold.toLocaleString('en-IN')}`;
  return `±${threshold}% move`;
};

export default function Watchlist() {
  const { authToken } = useStore();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const [addTicker, setAddTicker]     = useState('');
  const [showAddAlert, setShowAddAlert] = useState<string | null>(null);
  const [alertCond, setAlertCond]     = useState('above');
  const [alertVal, setAlertVal]       = useState('');

  const watchlistQ = useQuery({
    queryKey: ['watchlist', authToken],
    queryFn: () => fetchWatchlist(authToken),
  });

  const alertsQ = useQuery({
    queryKey: ['alerts', authToken],
    queryFn: () => fetchAlerts(authToken),
  });

  const addMut = useMutation({
    mutationFn: (ticker: string) => addToWatchlist(ticker, '', authToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watchlist'] }); setAddTicker(''); },
  });

  const removeMut = useMutation({
    mutationFn: (ticker: string) => removeFromWatchlist(ticker, authToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const createAlertMut = useMutation({
    mutationFn: ({ ticker, condition, threshold }: { ticker: string; condition: string; threshold: number }) =>
      createAlert(ticker, condition, threshold, authToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setShowAddAlert(null);
      setAlertVal('');
    },
  });

  const deleteAlertMut = useMutation({
    mutationFn: (id: string) => deleteAlert(id, authToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const stocks  = watchlistQ.data ?? [];
  const alerts  = alertsQ.data ?? [];
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(stocks.length / PER_PAGE);
  const pageStocks = stocks.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeAlerts = alerts.filter(a => a.active && !a.triggered);
  const triggered    = alerts.filter(a => a.triggered);

  const handleAddAlert = () => {
    if (!showAddAlert || !alertVal) return;
    createAlertMut.mutate({ ticker: showAddAlert, condition: alertCond, threshold: Number(alertVal) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Watchlist &amp; Price Alerts</h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>Track stocks you're watching — get instant alerts when price hits your target</p>
        </div>
        {/* Add ticker */}
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <div style={{ position: 'relative', flex: isMobile ? 1 : 'unset' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
            <input
              value={addTicker}
              onChange={e => setAddTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addTicker && addMut.mutate(addTicker)}
              placeholder="Add ticker (e.g. INFY)"
              style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 9, paddingBottom: 9, width: isMobile ? '100%' : 200, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--tx)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => addTicker && addMut.mutate(addTicker)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Watching',       value: stocks.length,                icon: Star,          color: 'var(--brand)'  },
          { label: 'Active Alerts',  value: activeAlerts.length,          icon: Bell,          color: '#10b981'       },
          { label: 'Alerts Triggered',value: triggered.length,            icon: AlertTriangle, color: 'var(--gold)'   },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={17} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{s.label}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* Watchlist table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={14} color="var(--brand)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>My Watchlist</span>
            <span style={{ fontSize: 12, color: 'var(--tx-3)', marginLeft: 'auto' }}>{stocks.length} stocks</span>
          </div>

          {stocks.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--tx-3)' }}>
              <Star size={32} style={{ margin: '0 auto 12px', opacity: 0.25 }} />
              <div style={{ fontSize: 13.5 }}>No stocks in watchlist yet</div>
              <div style={{ fontSize: 12.5, marginTop: 6 }}>Search for a ticker above to get started</div>
            </div>
          ) : isMobile ? (
            /* Mobile card list */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pageStocks.map(s => {
                const stockAlerts = alerts.filter(a => a.ticker === s.ticker);
                const isPos = s.changePct >= 0;
                return (
                  <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--tx)', fontSize: 14 }}>{s.ticker}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 1 }}>{s.name}</div>
                      {stockAlerts.length > 0 && (
                        <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '1px 7px', borderRadius: 99, fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
                          {stockAlerts.length} alert{stockAlerts.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>₹{s.price.toLocaleString('en-IN')}</div>
                      <div className="num" style={{ fontSize: 12, color: isPos ? 'var(--gain)' : 'var(--loss)', fontWeight: 700, marginTop: 2 }}>
                        {isPos ? '+' : ''}{s.changePct?.toFixed(2)}%
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--brand-dim)', padding: '2px 8px', borderRadius: 99, marginTop: 4 }}>
                        <Zap size={9} color="var(--brand)" />
                        <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{s.convictionScore ?? '—'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setShowAddAlert(s.ticker)} title="Set alert"
                        style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', cursor: 'pointer' }}>
                        <Bell size={13} />
                      </button>
                      <button onClick={() => removeMut.mutate(s.ticker)} title="Remove"
                        style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,77,106,0.2)', background: 'transparent', color: 'var(--loss)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Stock', 'Price', 'Change', 'AI Score', 'Alerts', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Stock' ? 'left' : 'right', fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map(s => {
                  const stockAlerts = alerts.filter(a => a.ticker === s.ticker);
                  const isPos = s.changePct >= 0;
                  return (
                    <tr key={s.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--tx)', fontSize: 13.5 }}>{s.ticker}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 1 }}>{s.name}</div>
                        {s.notes && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2, fontStyle: 'italic' }}>{s.notes}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>₹{s.price.toLocaleString('en-IN')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, color: isPos ? 'var(--gain)' : 'var(--loss)', fontWeight: 700 }} className="num">
                          {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {isPos ? '+' : ''}{s.changePct?.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-dim)', padding: '3px 10px', borderRadius: 99 }}>
                          <Zap size={10} color="var(--brand)" />
                          <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>{s.convictionScore ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {stockAlerts.length > 0 ? (
                          <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                            {stockAlerts.length} alert{stockAlerts.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setShowAddAlert(s.ticker)}
                            title="Set price alert"
                            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', cursor: 'pointer' }}
                          >
                            <Bell size={13} />
                          </button>
                          <button
                            onClick={() => removeMut.mutate(s.ticker)}
                            title="Remove from watchlist"
                            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,77,106,0.2)', background: 'transparent', color: 'var(--loss)', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={stocks.length} perPage={PER_PAGE} />
              </div>
            </div>
          )}
        </div>

        {/* Alerts panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active alerts */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={14} color="#10b981" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Active Alerts</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 99 }}>{activeAlerts.length} active</span>
            </div>
            {activeAlerts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                <BellOff size={24} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
                No active alerts
              </div>
            ) : (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeAlerts.map(alert => (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{alert.ticker}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 2 }}>{conditionLabel(alert.condition, alert.threshold)}</div>
                    </div>
                    <button
                      onClick={() => deleteAlertMut.mutate(alert.id)}
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Triggered alerts */}
          {triggered.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="var(--gold)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Triggered</span>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {triggered.map(alert => (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(245,166,35,0.06)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(245,166,35,0.2)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{alert.ticker}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{conditionLabel(alert.condition, alert.threshold)} — triggered</div>
                    </div>
                    <button
                      onClick={() => deleteAlertMut.mutate(alert.id)}
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--tx-3)', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Premium CTA */}
          <div style={{ background: 'linear-gradient(135deg, rgba(244,117,32,0.12) 0%, rgba(167,139,250,0.08) 100%)', border: '1px solid rgba(244,117,32,0.3)', borderRadius: 'var(--r-md)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Bell size={14} color="var(--brand)" />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>WhatsApp &amp; SMS Alerts</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.6, marginBottom: 12 }}>
              Get instant price alerts on WhatsApp when your targets hit — never miss an entry or exit point.
            </p>
            <button style={{ width: '100%', background: 'var(--brand)', border: 'none', color: '#fff', padding: '9px 0', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Upgrade to Pro — ₹299/mo
            </button>
          </div>
        </div>
      </div>

      {/* Add Alert Modal */}
      {showAddAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative' }}>
            <button onClick={() => setShowAddAlert(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Bell size={15} color="var(--brand)" />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>Set Alert — {showAddAlert}</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--tx-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>CONDITION</label>
              <Dropdown options={CONDITIONS} value={alertCond} onChange={setAlertCond} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--tx-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                {alertCond === 'pct_change' ? 'PERCENTAGE (%)' : 'TARGET PRICE (₹)'}
              </label>
              <input
                type="number"
                value={alertVal}
                onChange={e => setAlertVal(e.target.value)}
                placeholder={alertCond === 'pct_change' ? 'e.g. 5' : 'e.g. 4500'}
                style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 14px', fontSize: 14, color: 'var(--tx)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddAlert(null)} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleAddAlert}
                disabled={!alertVal}
                style={{ flex: 2, padding: '9px 0', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: alertVal ? 'pointer' : 'not-allowed', opacity: alertVal ? 1 : 0.5 }}
              >
                <Bell size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Set Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
