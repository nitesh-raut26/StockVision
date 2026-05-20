import { useNavigate } from 'react-router-dom';
import { Bookmark, BarChart3, GitCompare, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import ConvictionBadge from './ConvictionBadge';
import { generateChartData } from '../../data/mockData';
import { useStore } from '../../store/useStore';

interface Stock {
  ticker: string; name: string; sector: string; price: number; change: number;
  changePct: number; convictionScore: number; marketCap: number | string; target12m: number; risk: string;
  description: string; volumeSpike?: boolean;
}

interface Props { stock: Stock; }

export default function StockCard({ stock }: Props) {
  const navigate = useNavigate();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useStore();
  const inWatchlist   = watchlist.includes(stock.ticker);
  const positive      = stock.changePct >= 0;
  const hasValidUpside = stock.price > 0 && stock.target12m > 0;
  const upsideNum     = hasValidUpside ? (((stock.target12m - stock.price) / stock.price) * 100) : null;
  const upsideStr     = upsideNum !== null ? `${upsideNum >= 0 ? '+' : ''}${upsideNum.toFixed(1)}%` : 'N/A';
  const chartData     = generateChartData(30, stock.price > 0 ? stock.price * 0.9 : 100);

  return (
    <div className="card"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 0, transition: 'border-color 180ms, box-shadow 200ms', cursor: 'pointer' }}
      onClick={() => navigate(`/app/stock/${stock.ticker}`)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-lg)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
      }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)' }}>{stock.ticker}</span>
            <span style={{ fontSize: 10.5, padding: '2px 8px', background: 'var(--brand-dim)', color: 'var(--brand)', borderRadius: 99, fontWeight: 600 }}>{stock.sector}</span>
            {stock.volumeSpike && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, padding: '2px 8px', background: 'rgba(245,166,35,0.12)', color: 'var(--gold)', borderRadius: 99, fontWeight: 600 }}>
                <Zap size={10} /> Vol Spike
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.5, paddingRight: 12 }}>{stock.name}</p>
        </div>
        <ConvictionBadge score={stock.convictionScore} size="md" />
      </div>

      {/* Mini chart */}
      <div style={{ height: 52, marginBottom: 14 }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="price" stroke={positive ? 'var(--gain)' : 'var(--loss)'} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)' }}>₹{stock.price.toLocaleString('en-IN')}</span>
        <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: positive ? 'var(--gain)' : 'var(--loss)' }}>
          {positive ? '+' : ''}{stock.changePct.toFixed(2)}%
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Mkt Cap', value: stock.marketCap },
          { label: 'Risk',    value: stock.risk },
          { label: 'Upside',  value: upsideStr, gain: upsideNum !== null && upsideNum >= 0 },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</p>
            <p className="num" style={{ fontSize: 12.5, fontWeight: 700, color: s.gain ? 'var(--gain)' : 'var(--tx-2)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Target */}
      <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 14 }}>
        12M target: <span className="num" style={{ color: 'var(--tx)', fontWeight: 600 }}>{stock.target12m > 0 ? `₹${stock.target12m.toLocaleString('en-IN')}` : 'N/A'}</span>
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => inWatchlist ? removeFromWatchlist(stock.ticker) : addToWatchlist(stock.ticker)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 0', borderRadius: 'var(--r-sm)', border: inWatchlist ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: inWatchlist ? 'var(--brand-dim)' : 'transparent', color: inWatchlist ? 'var(--brand)' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}>
          <Bookmark size={12} fill={inWatchlist ? 'currentColor' : 'none'} /> {inWatchlist ? 'Saved' : 'Watchlist'}
        </button>
        <button
          onClick={() => navigate(`/app/dcf/${stock.ticker}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-brand)'; (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'; }}>
          <BarChart3 size={12} /> DCF
        </button>
        <button
          onClick={() => navigate(`/app/comps/${stock.ticker}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-brand)'; (e.currentTarget as HTMLElement).style.color = 'var(--brand)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx-3)'; }}>
          <GitCompare size={12} /> Comps
        </button>
      </div>
    </div>
  );
}
