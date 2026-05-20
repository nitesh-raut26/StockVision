import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, Download, Info, ChevronLeft, BarChart2 } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from 'recharts';
import { mockStocks } from '../data/mockData';

const peers: Record<string, string[]> = {
  RELIANCE: ['ONGC', 'IOC', 'BPCL', 'NTPC'],
  HDFCBANK: ['ICICIBANK', 'AXISBANK', 'KOTAKBANK', 'SBI'],
  HAL: ['BEL', 'MTAR', 'PARAS', 'IDEAFORGE'],
  default: ['BEL', 'HAL', 'MTAR', 'PARAS'],
};

interface PeerRow {
  name: string; marketCap: number; ev: number; revenue: number;
  evRevenue: number; evEbitda: number; pe: number;
  revenueGrowth: number; ebitdaMargin: number; isSubject?: boolean;
}

const peerData: Record<string, PeerRow> = {
  ONGC:      { name: 'ONGC',          marketCap: 342000, ev: 388000, revenue: 138400, evRevenue: 2.80, evEbitda: 8.4,  pe: 12.4, revenueGrowth: 4.2,  ebitdaMargin: 33.2 },
  IOC:       { name: 'IOC',           marketCap: 198000, ev: 228000, revenue: 876000, evRevenue: 0.26, evEbitda: 5.8,  pe: 9.2,  revenueGrowth: -2.1, ebitdaMargin: 4.5  },
  BPCL:      { name: 'BPCL',          marketCap: 124000, ev: 148000, revenue: 492000, evRevenue: 0.30, evEbitda: 6.1,  pe: 10.8, revenueGrowth: 1.4,  ebitdaMargin: 4.9  },
  NTPC:      { name: 'NTPC',          marketCap: 342000, ev: 486000, revenue: 174800, evRevenue: 2.78, evEbitda: 9.2,  pe: 18.4, revenueGrowth: 8.4,  ebitdaMargin: 30.2 },
  BEL:       { name: 'BEL',           marketCap: 22850,  ev: 22000,  revenue: 15890,  evRevenue: 1.38, evEbitda: 28.5, pe: 41.5, revenueGrowth: 18.7, ebitdaMargin: 4.8  },
  MTAR:      { name: 'MTAR Tech',     marketCap: 4890,   ev: 5100,   revenue: 412,    evRevenue: 12.4, evEbitda: 52.8, pe: 82.4, revenueGrowth: 31.8, ebitdaMargin: 23.5 },
  PARAS:     { name: 'Paras Defence', marketCap: 2840,   ev: 2900,   revenue: 320,    evRevenue: 9.06, evEbitda: 45.2, pe: 68.4, revenueGrowth: 28.4, ebitdaMargin: 20.1 },
  IDEAFORGE: { name: 'IdeaForge',     marketCap: 1850,   ev: 1750,   revenue: 186,    evRevenue: 9.4,  evEbitda: 32.1, pe: 48.2, revenueGrowth: 34.2, ebitdaMargin: 29.3 },
  HAL:       { name: 'HAL',           marketCap: 138200, ev: 128000, revenue: 28520,  evRevenue: 4.49, evEbitda: 24.2, pe: 32.8, revenueGrowth: 22.1, ebitdaMargin: 18.5 },
};

const cardVariant = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } },
};

const median = (arr: number[]) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const TH = ({ children, right = false }: { children?: React.ReactNode; right?: boolean }) => (
  <th style={{ textAlign: right ? 'right' : 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{children}</th>
);

export default function CompsAnalysis() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();
  const subject    = mockStocks.find(s => s.ticker === ticker) ?? mockStocks[0];
  const defaultPeers = peers[ticker ?? ''] ?? peers.default;
  const [activePeers, setActivePeers] = useState(defaultPeers);

  const subjectRow = {
    name: subject.name, marketCap: subject.marketCap, ev: subject.marketCap * 1.1,
    revenue: subject.revenue,
    evRevenue: parseFloat(((subject.marketCap * 1.1) / subject.revenue).toFixed(2)),
    evEbitda: subject.evEbitda, pe: subject.pe,
    revenueGrowth: subject.revenueGrowth,
    ebitdaMargin: Number((((subject.revenue * (subject.evEbitda / 10)) / subject.revenue) * 100).toFixed(1)),
  };

  const rows = activePeers.map(p => peerData[p]).filter(Boolean);
  const medianEv  = median(rows.map(r => r.evEbitda));
  const premium   = (((subjectRow.evEbitda - medianEv) / medianEv) * 100).toFixed(1);
  const isPremium = parseFloat(premium) > 0;

  const removePeer = (p: string) => setActivePeers(prev => prev.filter(x => x !== p));

  return (
    <motion.div initial="initial" animate="animate"
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <motion.div variants={cardVariant} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-0.025em', marginBottom: 4 }}>Comparable Company Analysis</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>{subject.name} vs Sector Peers · {subject.sector}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/app/stock/${ticker}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Back
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="btn-primary btn-glow"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}>
            <Download size={14} /> Download Excel
          </motion.button>
        </div>
      </motion.div>

      {/* Premium / discount badge */}
      <motion.div variants={cardVariant}
        style={{ padding: '18px 22px', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          background: isPremium ? 'rgba(244,117,32,0.08)' : 'rgba(45,181,98,0.08)',
          border: `1px solid ${isPremium ? 'rgba(244,117,32,0.3)' : 'rgba(45,181,98,0.3)'}` }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: isPremium ? 'var(--brand)' : 'var(--gain)', marginBottom: 4 }}>
            {subject.name} trades at a <strong>{Math.abs(parseFloat(premium))}% {isPremium ? 'premium' : 'discount'}</strong> to peer median EV/EBITDA
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>
            Subject EV/EBITDA: {subjectRow.evEbitda}x · Peer Median: {medianEv.toFixed(1)}x · {isPremium ? 'Justified by growth premium and sector leadership.' : 'Potential re-rating opportunity exists.'}
          </div>
        </div>
        <Info size={20} color={isPremium ? 'var(--brand)' : 'var(--gain)'} style={{ flexShrink: 0 }} />
      </motion.div>

      {/* Multiples comparison bar charts */}
      <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <BarChart2 size={15} color="var(--brand)" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Multiples Comparison</h3>
          <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>— Subject company highlighted in orange</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
          {([
            { key: 'evEbitda',  label: 'EV / EBITDA', unit: 'x' },
            { key: 'pe',        label: 'P/E',          unit: 'x' },
            { key: 'evRevenue', label: 'EV / Revenue', unit: 'x' },
          ] as { key: keyof typeof rows[0]; label: string; unit: string }[]).map(metric => {
            const allRows = [...rows, { ...subjectRow, isSubject: true }];
            const chartData = allRows.map(r => ({
              name: r.name.split(' ')[0],
              value: (r as any)[metric.key] as number,
              isSubject: (r as any).isSubject,
            }));
            const medianVal = median(rows.map(r => (r as any)[metric.key] as number));
            const maxVal = Math.max(...chartData.map(d => d.value)) * 1.15;
            return (
              <div key={metric.key}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{metric.label}</p>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                    <BarChart data={chartData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, maxVal]} tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} tickFormatter={v => `${v}${metric.unit}`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 11.5 }}
                        formatter={(v: any) => [`${v}${metric.unit}`, metric.label]}
                      />
                      <ReferenceLine y={medianVal} stroke="var(--brand)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `Med ${medianVal.toFixed(1)}${metric.unit}`, position: 'insideTopRight', fill: 'var(--brand)', fontSize: 10 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.isSubject ? 'var(--brand)' : 'rgba(99,102,241,0.55)'} />
                        ))}
                        <LabelList dataKey="value" position="top" style={{ fill: 'var(--tx-3)', fontSize: 9.5 }} formatter={(v: any) => `${v}${metric.unit}`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Operating metrics table */}
      <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 18 }}>Operating Metrics</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Company</TH>
                <TH right>Revenue (Cr)</TH>
                <TH right>Rev Growth</TH>
                <TH right>EBITDA Margin</TH>
                <TH right>Market Cap (Cr)</TH>
              </tr>
            </thead>
            <tbody>
              {[...rows, { ...subjectRow, isSubject: true }].map((r, i) => (
                <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  style={{ background: r.isSubject ? 'rgba(244,117,32,0.06)' : 'transparent', borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: r.isSubject ? 'var(--brand)' : 'var(--tx)' }}>{r.name}</div>
                    {r.isSubject && <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 2, opacity: 0.7 }}>Subject Company ⭐</div>}
                  </td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{r.revenue?.toLocaleString('en-IN')}</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, fontWeight: 600, color: r.revenueGrowth >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                    {r.revenueGrowth >= 0 ? '+' : ''}{r.revenueGrowth}%
                  </td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{r.ebitdaMargin}%</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{r.marketCap?.toLocaleString('en-IN')}</td>
                </motion.tr>
              ))}
              <tr style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-md)' }}>
                <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: 'var(--tx-3)' }}>Peer Median</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>₹{Math.round(median(rows.map(r => r.revenue))).toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>{median(rows.map(r => r.revenueGrowth)).toFixed(1)}%</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>{median(rows.map(r => r.ebitdaMargin)).toFixed(1)}%</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>₹{Math.round(median(rows.map(r => r.marketCap))).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Valuation multiples table */}
      <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 18 }}>Valuation Multiples</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Company</TH>
                <TH right>Market Cap</TH>
                <TH right>EV</TH>
                <TH right>EV/Revenue</TH>
                <TH right>EV/EBITDA</TH>
                <TH right>P/E</TH>
                <TH></TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                  <td style={{ padding: '14px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{r.name}</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{r.marketCap?.toLocaleString('en-IN')}</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{r.ev?.toLocaleString('en-IN')}</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{r.evRevenue}x</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{r.evEbitda}x</td>
                  <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{r.pe}x</td>
                  <td style={{ padding: '14px 10px' }}>
                    <button onClick={() => removePeer(activePeers[i])}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, borderRadius: 6, transition: 'color 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--loss)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-3)')}>
                      <X size={14} />
                    </button>
                  </td>
                </motion.tr>
              ))}

              {/* Subject row */}
              <tr style={{ background: 'rgba(244,117,32,0.06)', borderBottom: '1px solid rgba(244,117,32,0.2)', borderTop: '1px solid rgba(244,117,32,0.2)' }}>
                <td style={{ padding: '14px 14px', fontSize: 13.5, fontWeight: 800, color: 'var(--brand)' }}>{subject.name} ⭐</td>
                <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{subjectRow.marketCap.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>₹{Math.round(subjectRow.ev).toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{subjectRow.evRevenue}x</td>
                <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13 }}>
                  <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{subjectRow.evEbitda}x</span>
                  <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: isPremium ? 'var(--brand)' : 'var(--gain)' }}>
                    {isPremium ? `+${premium}%` : `${premium}%`} vs median
                  </span>
                </td>
                <td className="num" style={{ textAlign: 'right', padding: '14px 14px', fontSize: 13, color: 'var(--tx)' }}>{subjectRow.pe}x</td>
                <td />
              </tr>

              {/* Median row */}
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: 'var(--tx-3)' }}>Peer Median</td>
                <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>—</td>
                <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>—</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>{median(rows.map(r => r.evRevenue)).toFixed(2)}x</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>{medianEv.toFixed(1)}x</td>
                <td className="num" style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12, color: 'var(--tx-2)' }}>{median(rows.map(r => r.pe)).toFixed(1)}x</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add peer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--tx-3)', fontWeight: 600 }}>Add peer:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.keys(peerData).filter(p => !activePeers.includes(p) && p !== ticker).map(p => (
              <motion.button key={p} whileHover={{ scale: 1.05, borderColor: 'var(--border-brand)', color: 'var(--brand)' }}
                onClick={() => setActivePeers(prev => [...prev, p])}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}>
                <Plus size={11} /> {p}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
