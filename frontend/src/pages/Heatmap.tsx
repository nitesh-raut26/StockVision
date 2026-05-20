import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { mockHeatmapData } from '../data/mockData';
import { fetchHeatmap } from '../lib/api';

const sectors = ['All', 'Energy', 'IT', 'Banking', 'Defence', 'FMCG', 'Auto', 'Pharma', 'NBFC'];

const getColor = (change: number) => {
  if (change >= 5)  return { bg: '#0a7c5c', border: '#059669', text: '#fff' };
  if (change >= 3)  return { bg: '#0d9067', border: '#059669', text: '#fff' };
  if (change >= 1)  return { bg: 'rgba(0,200,150,0.18)', border: 'rgba(0,200,150,0.45)', text: 'var(--gain)' };
  if (change >= 0)  return { bg: 'rgba(0,200,150,0.07)', border: 'rgba(0,200,150,0.2)',  text: 'var(--gain)' };
  if (change >= -1) return { bg: 'rgba(255,77,106,0.07)', border: 'rgba(255,77,106,0.2)', text: 'var(--loss)' };
  if (change >= -3) return { bg: '#a01830', border: '#e53935', text: '#fff' };
  return               { bg: '#7f0d1e', border: '#e53935', text: '#fff' };
};

const legend = [
  { label: '+5%+',  bg: '#0a7c5c' },
  { label: '+3–5%', bg: '#0d9067' },
  { label: '0–3%',  bg: 'rgba(0,200,150,0.25)' },
  { label: '0–-3%', bg: '#a01830' },
  { label: '-5%+',  bg: '#7f0d1e' },
];

export default function Heatmap() {
  const navigate = useNavigate();
  const [sector, setSector] = useState('All');
  const [hovered, setHovered] = useState<string | null>(null);
  const heatmapQuery = useQuery({
    queryKey: ['heatmap'],
    queryFn: fetchHeatmap,
    refetchInterval: 30000,
  });

  const allStocks  = heatmapQuery.data ?? mockHeatmapData;
  const filtered   = allStocks.filter(s => sector === 'All' || s.sector === sector);
  const maxCap     = Math.max(...filtered.map(s => s.marketCap));
  const advancers  = filtered.filter(s => s.change >= 0).length;
  const decliners  = filtered.filter(s => s.change < 0).length;
  const spikes     = filtered.filter(s => s.volumeSpike).length;
  const hoveredStock = hovered ? filtered.find(x => x.ticker === hovered) : null;

  // Sector performance aggregates
  const sectorStats = sectors.slice(1).map(sec => {
    const secStocks = allStocks.filter(s => s.sector === sec);
    const avg = secStocks.length
      ? secStocks.reduce((sum, s) => sum + s.change, 0) / secStocks.length
      : 0;
    const totalCap = secStocks.reduce((sum, s) => sum + s.marketCap, 0);
    return { sector: sec, avg: parseFloat(avg.toFixed(2)), count: secStocks.length, totalCap };
  }).sort((a, b) => b.avg - a.avg);

  // Top gainers & losers
  const sorted = [...filtered].sort((a, b) => b.change - a.change);
  const topGainers = sorted.slice(0, 5);
  const topLosers  = sorted.slice(-5).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Interactive Market Heatmap</h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>Nifty 500 — cell size = market cap, color = daily change. Highlighted border = volume spike.</p>
      </div>

      {/* Stats bar */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp size={16} color="var(--gain)" />
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advancers</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--gain)' }}>{advancers}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingDown size={16} color="var(--loss)" />
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decliners</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--loss)' }}>{decliners}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={16} color="var(--gold)" />
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vol Spikes</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{spikes}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>A/D Ratio</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: advancers > decliners ? 'var(--gain)' : 'var(--loss)' }}>
              {advancers}:{decliners}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {legend.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg }} />
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sector performance summary row */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {sectorStats.map(s => {
          const pos = s.avg >= 0;
          return (
            <button
              key={s.sector}
              onClick={() => setSector(s.sector)}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                border: sector === s.sector ? '1px solid var(--border-brand)' : `1px solid ${pos ? 'rgba(0,200,150,0.25)' : 'rgba(255,77,106,0.25)'}`,
                background: sector === s.sector ? 'var(--brand-dim)' : pos ? 'rgba(0,200,150,0.05)' : 'rgba(255,77,106,0.05)',
                fontFamily: 'inherit', transition: 'all 150ms', minWidth: 80,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sector === s.sector ? 'var(--brand)' : 'var(--tx-2)', marginBottom: 3 }}>{s.sector}</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 800, color: sector === s.sector ? 'var(--brand)' : pos ? 'var(--gain)' : 'var(--loss)' }}>
                {pos ? '+' : ''}{s.avg}%
              </span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 1 }}>{s.count} stocks</span>
            </button>
          );
        })}
        <button
          onClick={() => setSector('All')}
          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: sector === 'All' ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: sector === 'All' ? 'var(--brand-dim)' : 'transparent', fontFamily: 'inherit', minWidth: 60 }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: sector === 'All' ? 'var(--brand)' : 'var(--tx-2)', marginBottom: 3 }}>All</span>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Nifty 500</span>
        </button>
      </div>

      {/* Heatmap grid */}
      <div className="card" style={{ padding: 16 }}>
        <div
          className="heatmap-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridAutoRows: 80, gap: 4 }}
          data-hovered={hovered || ''}
        >
          {filtered.map(stock => {
            const colors = getColor(stock.change);
            const isLarge  = stock.marketCap >= maxCap * 0.2;
            const isMedium = stock.marketCap >= maxCap * 0.05;
            const isHovered = hovered === stock.ticker;
            const isDimmed  = hovered && !isHovered;
            return (
              <div
                key={stock.ticker}
                onClick={() => navigate(`/app/stock/${stock.ticker}`)}
                onMouseEnter={() => setHovered(stock.ticker)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  gridColumn: isLarge ? 'span 3' : isMedium ? 'span 2' : 'span 1',
                  gridRow:    isLarge ? 'span 3' : isMedium ? 'span 2' : 'span 1',
                  background: colors.bg,
                  border: stock.volumeSpike ? `2px solid var(--gold)` : `1px solid ${colors.border}`,
                  borderRadius: 8,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 2, padding: 4, overflow: 'hidden',
                  opacity: isDimmed ? 0.45 : 1,
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  zIndex: isHovered ? 2 : 1,
                  transition: 'opacity 200ms ease, transform 200ms ease',
                  willChange: 'opacity, transform',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, lineHeight: 1 }}>{stock.ticker.slice(0, 7)}</span>
                <span className="num" style={{ fontSize: 11, fontWeight: 600, color: colors.text }}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
                </span>
                {isLarge && (
                  <span style={{ fontSize: 10, color: colors.text, opacity: 0.8, textAlign: 'center' }}>{stock.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {hoveredStock && (() => {
        const c = getColor(hoveredStock.change);
        return (
          <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, border: `1px solid ${c.border}`, flexShrink: 0 }}>
              {hoveredStock.change >= 0 ? <TrendingUp size={16} color={c.text} /> : <TrendingDown size={16} color={c.text} />}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{hoveredStock.ticker}</div>
              <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{hoveredStock.name} · {hoveredStock.sector}</div>
            </div>
            <div className="num" style={{ fontSize: 22, fontWeight: 800, color: hoveredStock.change >= 0 ? 'var(--gain)' : 'var(--loss)', marginLeft: 8 }}>
              {hoveredStock.change >= 0 ? '+' : ''}{hoveredStock.change.toFixed(2)}%
            </div>
            {hoveredStock.volumeSpike && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'rgba(245,166,35,0.12)', color: 'var(--gold)', border: '1px solid rgba(245,166,35,0.3)' }}>
                Volume Spike
              </span>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Market Cap</div>
              <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>
                ₹{(hoveredStock.marketCap / 100000).toFixed(1)}L Cr
              </div>
            </div>
          </div>
        );
      })()}

      {/* Top Gainers & Losers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Gainers */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpRight size={15} color="var(--gain)" />
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Top Gainers</h3>
          </div>
          <div>
            {topGainers.map((s, i) => (
              <div key={s.ticker}
                onClick={() => navigate(`/app/stock/${s.ticker}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{s.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{s.sector}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--gain)' }}>+{s.change.toFixed(2)}%</div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--tx-3)' }}>₹{(s.marketCap / 100000).toFixed(0)}L Cr</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownRight size={15} color="var(--loss)" />
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Top Losers</h3>
          </div>
          <div>
            {topLosers.map((s, i) => (
              <div key={s.ticker}
                onClick={() => navigate(`/app/stock/${s.ticker}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{s.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{s.sector}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--loss)' }}>{s.change.toFixed(2)}%</div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--tx-3)' }}>₹{(s.marketCap / 100000).toFixed(0)}L Cr</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
