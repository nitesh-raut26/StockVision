import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fetchOptionsChain, fetchOptionExpiries } from '../lib/api';
import PlanGate, { usePlanAccess } from '../components/ui/PlanGate';
import {
  TrendingUp, TrendingDown, ChevronUp, ChevronDown, Activity,
  AlertCircle, BarChart3, Zap, Search,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import Dropdown from '../components/ui/Dropdown';

/* ── Types ─────────────────────────────────────────────────────── */
interface OptionRow {
  strike: number;
  callOI: number; callOIChg: number; callVol: number; callLTP: number; callChg: number; callIV: number;
  putOI: number;  putOIChg: number;  putVol: number;  putLTP: number;  putChg: number;  putIV: number;
  isATM?: boolean;
}

/* ── Backend (/options) → view mapping; demo generators below are the fallback ─ */
interface BackendOptionRow {
  strike: number;
  call_ltp: number; call_oi: number; call_vol: number; call_iv: number;
  put_ltp: number;  put_oi: number;  put_vol: number;  put_iv: number;
  atm: boolean;
}
const mapOptionRow = (r: BackendOptionRow): OptionRow => ({
  strike: r.strike,
  callOI: r.call_oi, callOIChg: 0, callVol: r.call_vol, callLTP: r.call_ltp, callChg: 0, callIV: r.call_iv,
  putOI:  r.put_oi,  putOIChg: 0,  putVol:  r.put_vol,  putLTP:  r.put_ltp,  putChg:  0, putIV:  r.put_iv,
  isATM:  r.atm,
});
function fmtExpiryLabel(e: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e);
  if (!m) return e;
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]} ${M[Number(m[2]) - 1]} ${m[1]}`;
}

/* ── Mock data generators ──────────────────────────────────────── */
const UNDERLYINGS = [
  { symbol: 'NIFTY',     spotPrice: 24834.85, lot: 50  },
  { symbol: 'BANKNIFTY', spotPrice: 53218.40, lot: 15  },
  { symbol: 'FINNIFTY',  spotPrice: 23412.60, lot: 40  },
  { symbol: 'SENSEX',    spotPrice: 81426.80, lot: 10  },
  { symbol: 'HAL',       spotPrice: 4125.80,  lot: 150 },
  { symbol: 'RELIANCE',  spotPrice: 2847.50,  lot: 250 },
  { symbol: 'HDFCBANK',  spotPrice: 1712.30,  lot: 550 },
  { symbol: 'TCS',       spotPrice: 3542.10,  lot: 175 },
];

const EXPIRIES = ['29 May 2026', '05 Jun 2026', '12 Jun 2026', '26 Jun 2026', '25 Sep 2026', '25 Dec 2026'];

function buildChain(spot: number): OptionRow[] {
  const step = spot > 30000 ? 500 : spot > 5000 ? 100 : spot > 2000 ? 50 : 20;
  const base = Math.round(spot / step) * step;
  const rows: OptionRow[] = [];

  for (let i = -10; i <= 10; i++) {
    const strike = base + i * step;
    const moneyness = (spot - strike) / spot;
    const isATM = Math.abs(moneyness) < 0.008;

    const callItm = moneyness > 0;
    const d1Approx = moneyness * 8 + 0.5;
    const callIV = 14 + Math.abs(i) * 0.6 + (i < 0 ? 1 : 0);
    const putIV  = 14 + Math.abs(i) * 0.8 + (i > 0 ? 1.5 : 0);
    const callLTP = Math.max(0.05, callItm ? Math.abs(spot - strike) + Math.random() * 20 + 5 : Math.random() * 30 + 2);
    const putLTP  = Math.max(0.05, !callItm ? Math.abs(spot - strike) + Math.random() * 20 + 5 : Math.random() * 30 + 2);

    const baseOI = 3000000;
    const callOI = Math.round(baseOI * Math.max(0.1, d1Approx + Math.random() * 0.4) * (i >= 0 ? 1.5 : 0.6));
    const putOI  = Math.round(baseOI * Math.max(0.1, (1 - d1Approx) + Math.random() * 0.4) * (i <= 0 ? 1.5 : 0.6));

    rows.push({
      strike,
      callOI, callOIChg: Math.round((Math.random() - 0.35) * callOI * 0.15),
      callVol: Math.round(callOI * (0.05 + Math.random() * 0.12)),
      callLTP: parseFloat(callLTP.toFixed(2)),
      callChg: parseFloat(((Math.random() - 0.45) * 8).toFixed(2)),
      callIV: parseFloat(callIV.toFixed(1)),
      putOI, putOIChg: Math.round((Math.random() - 0.35) * putOI * 0.15),
      putVol: Math.round(putOI * (0.05 + Math.random() * 0.12)),
      putLTP: parseFloat(putLTP.toFixed(2)),
      putChg: parseFloat(((Math.random() - 0.45) * 8).toFixed(2)),
      putIV: parseFloat(putIV.toFixed(1)),
      isATM,
    });
  }
  return rows;
}

/* ── Helpers ───────────────────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const cardV = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } }),
};

/* ── Main ──────────────────────────────────────────────────────── */
export default function OptionsChain() {
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();
  const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
  const [expiry, setExpiry]         = useState(EXPIRIES[0]);
  const [view, setView]             = useState<'chain' | 'oi' | 'pcr'>('chain');
  const [search, setSearch]         = useState('');

  // ── Live expiries + chain from /options (falls back to the demo generator) ──
  const expiriesQuery = useQuery({ queryKey: ['options', 'expiries'], queryFn: fetchOptionExpiries });
  const expiries = expiriesQuery.data ?? EXPIRIES;
  const activeExpiry = expiries.includes(expiry) ? expiry : expiries[0];

  const chainQuery = useQuery({
    queryKey: ['options', 'chain', underlying.symbol, activeExpiry],
    queryFn: () => fetchOptionsChain(underlying.symbol, activeExpiry),
  });
  const isLive = Boolean(chainQuery.data);

  const fallbackChain = useMemo(() => buildChain(underlying.spotPrice), [underlying.spotPrice]);
  const chain: OptionRow[] = chainQuery.data
    ? (chainQuery.data.chain as unknown as BackendOptionRow[]).map(mapOptionRow)
    : fallbackChain;

  const spot = chainQuery.data?.spot ?? underlying.spotPrice;

  const totalCallOI = chain.reduce((s, r) => s + r.callOI, 0);
  const totalPutOI  = chain.reduce((s, r) => s + r.putOI, 0);
  const pcr = (chainQuery.data?.pcr ?? (totalCallOI ? totalPutOI / totalCallOI : 1)).toFixed(2);
  const maxCallOI = Math.max(...chain.map(r => r.callOI));
  const maxPutOI  = Math.max(...chain.map(r => r.putOI));
  const maxOI     = Math.max(maxCallOI, maxPutOI);

  const supportStrike  = chainQuery.data?.support    ?? chain.slice().sort((a, b) => b.putOI  - a.putOI)[0]?.strike;
  const resistStrike   = chainQuery.data?.resistance ?? chain.slice().sort((a, b) => b.callOI - a.callOI)[0]?.strike;
  const maxPain        = chainQuery.data?.max_pain   ?? Math.round(spot * 0.998 / (spot > 5000 ? 100 : 50)) * (spot > 5000 ? 100 : 50);

  const ivSkew = chain.find(r => r.isATM);

  const hasAccess = usePlanAccess('premium');
  if (!hasAccess) return <PlanGate requires="premium" feature="Options Chain" mode="replace"><></></PlanGate>;

  return (
    <div style={{ maxWidth: 1400, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', marginBottom: 4 }}>
              Options Chain
            </h1>
            <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>
              NSE F&O · Live Put/Call OI · IV surface · Greeks
              <span style={{ color: isLive ? 'var(--gain)' : 'var(--gold)', marginLeft: 8, fontWeight: 600 }}>
                {isLive ? '● Live' : '● Demo'}
              </span>
            </p>
          </div>
          {/* PCR signal pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 12, background: parseFloat(pcr) > 1 ? 'rgba(0,200,150,0.08)' : 'rgba(255,77,106,0.08)', border: `1px solid ${parseFloat(pcr) > 1 ? 'rgba(0,200,150,0.3)' : 'rgba(255,77,106,0.3)'}` }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-3)', marginBottom: 2 }}>PUT/CALL RATIO</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: parseFloat(pcr) > 1 ? 'var(--gain)' : 'var(--loss)' }}>{pcr}</div>
              <div style={{ fontSize: 11, color: parseFloat(pcr) > 1.2 ? 'var(--gain)' : parseFloat(pcr) < 0.8 ? 'var(--loss)' : 'var(--gold)', fontWeight: 600, marginTop: 2 }}>
                {parseFloat(pcr) > 1.2 ? 'Bullish' : parseFloat(pcr) < 0.8 ? 'Bearish' : 'Neutral'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {/* Underlying selector */}
          <div style={{ position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-brand)', borderRadius: 10 }}>
              <Search size={13} color="var(--tx-3)" />
              <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => {}} placeholder="Symbol…"
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: 13.5, fontWeight: 700, width: 90, fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {UNDERLYINGS.filter(u => !search || u.symbol.includes(search.toUpperCase())).slice(0, 6).map(u => (
              <button key={u.symbol} onClick={() => { setUnderlying(u); setSearch(''); }}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: underlying.symbol === u.symbol ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: underlying.symbol === u.symbol ? 'var(--brand-dim)' : 'var(--surface-mid)', color: underlying.symbol === u.symbol ? 'var(--brand)' : 'var(--tx-2)', transition: 'all 120ms', fontFamily: 'inherit' }}>
                {u.symbol}
              </button>
            ))}
          </div>

          <Dropdown
            options={expiries.map(e => ({ label: fmtExpiryLabel(e), value: e }))}
            value={activeExpiry}
            onChange={setExpiry}
            style={{ minWidth: 160 }}
          />
        </div>

        {/* View tab */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
          {([['chain', 'Option Chain'], ['oi', 'OI Bar Chart'], ['pcr', 'IV Skew']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: view === v ? '2px solid var(--brand)' : '2px solid transparent', color: view === v ? 'var(--brand)' : 'var(--tx-3)', marginBottom: -1, fontFamily: 'inherit', transition: 'all 150ms' }}>
              {l}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <motion.div custom={0} variants={cardV} initial="hidden" animate="visible"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: `${underlying.symbol} Spot`, value: `₹${spot.toLocaleString('en-IN')}`, sub: 'Current Price', color: 'var(--tx)', icon: <Activity size={15} color="var(--brand)" /> },
          { label: 'Max Pain',   value: `₹${maxPain.toLocaleString('en-IN')}`, sub: 'Options expire near here', color: 'var(--gold)',  icon: <Zap size={15} color="var(--gold)" /> },
          { label: 'Support',    value: `₹${supportStrike?.toLocaleString('en-IN')}`,   sub: 'Highest Put OI',  color: 'var(--gain)', icon: <TrendingUp size={15} color="var(--gain)" /> },
          { label: 'Resistance', value: `₹${resistStrike?.toLocaleString('en-IN')}`,    sub: 'Highest Call OI', color: 'var(--loss)', icon: <TrendingDown size={15} color="var(--loss)" /> },
        ].map((s, i) => (
          <motion.div key={i} whileHover={{ y: -2 }} className="glass-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{s.label}</span>
              {s.icon}
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{s.sub}</div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══ OPTION CHAIN VIEW ══ */}
        {view === 'chain' && (
          <motion.div key="chain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {/* CALLS */}
                      <th colSpan={6} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gain)', borderRight: '2px solid var(--border-md)' }}>CALLS</th>
                      {/* STRIKE */}
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand)' }}>STRIKE</th>
                      {/* PUTS */}
                      <th colSpan={6} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--loss)', borderLeft: '2px solid var(--border-md)' }}>PUTS</th>
                    </tr>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['OI', 'OI Chg', 'Volume', 'IV%', 'LTP', 'Chg%'].map(h => (
                        <th key={`c-${h}`} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--brand)', borderLeft: '2px solid var(--border-md)', borderRight: '2px solid var(--border-md)' }}>STRIKE</th>
                      {['Chg%', 'LTP', 'IV%', 'Volume', 'OI Chg', 'OI'].map(h => (
                        <th key={`p-${h}`} style={{ padding: '8px 12px', textAlign: h === 'OI' ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chain.map((row, i) => {
                      const callBar = (row.callOI / maxOI) * 100;
                      const putBar  = (row.putOI  / maxOI) * 100;
                      return (
                        <motion.tr key={row.strike} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                          style={{ borderBottom: '1px solid var(--border)', background: row.isATM ? 'rgba(244,117,32,0.06)' : 'transparent' }}>
                          {/* CALL OI */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', position: 'relative' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${callBar}%`, background: 'rgba(0,200,150,0.08)', maxWidth: '100%' }} />
                            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', position: 'relative' }}>{fmt(row.callOI)}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <span className="num" style={{ fontSize: 11.5, fontWeight: 600, color: row.callOIChg > 0 ? 'var(--gain)' : row.callOIChg < 0 ? 'var(--loss)' : 'var(--tx-3)' }}>
                              {row.callOIChg > 0 ? '+' : ''}{fmt(row.callOIChg)}
                            </span>
                          </td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--tx-3)' }}>{fmt(row.callVol)}</td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: row.callIV > 20 ? 'var(--gold)' : 'var(--tx-2)', fontWeight: 600 }}>{row.callIV}%</td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{row.callLTP}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', borderRight: '2px solid var(--border-md)' }}>
                            <span className="num" style={{ fontSize: 12, fontWeight: 700, color: row.callChg >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                              {row.callChg >= 0 ? '+' : ''}{row.callChg}%
                            </span>
                          </td>
                          {/* STRIKE */}
                          <td style={{ padding: '10px 12px', textAlign: 'center', borderLeft: '2px solid var(--border-md)', borderRight: '2px solid var(--border-md)' }}>
                            <span className="num" style={{ fontSize: row.isATM ? 14 : 13, fontWeight: row.isATM ? 900 : 700, color: row.isATM ? 'var(--brand)' : 'var(--tx)' }}>
                              {row.strike.toLocaleString('en-IN')}
                              {row.isATM && <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.08em' }}>ATM</span>}
                            </span>
                          </td>
                          {/* PUTS */}
                          <td style={{ padding: '10px 12px', textAlign: 'left', borderLeft: '2px solid var(--border-md)' }}>
                            <span className="num" style={{ fontSize: 12, fontWeight: 700, color: row.putChg >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                              {row.putChg >= 0 ? '+' : ''}{row.putChg}%
                            </span>
                          </td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{row.putLTP}</td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: row.putIV > 20 ? 'var(--gold)' : 'var(--tx-2)', fontWeight: 600 }}>{row.putIV}%</td>
                          <td className="num" style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--tx-3)' }}>{fmt(row.putVol)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                            <span className="num" style={{ fontSize: 11.5, fontWeight: 600, color: row.putOIChg > 0 ? 'var(--gain)' : row.putOIChg < 0 ? 'var(--loss)' : 'var(--tx-3)' }}>
                              {row.putOIChg > 0 ? '+' : ''}{fmt(row.putOIChg)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${putBar}%`, background: 'rgba(255,77,106,0.08)', maxWidth: '100%' }} />
                            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', position: 'relative' }}>{fmt(row.putOI)}</span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <span>Total Call OI: <strong style={{ color: 'var(--gain)' }}>{fmt(totalCallOI)}</strong></span>
                <span>Total Put OI: <strong style={{ color: 'var(--loss)' }}>{fmt(totalPutOI)}</strong></span>
                <span>PCR: <strong style={{ color: parseFloat(pcr) > 1 ? 'var(--gain)' : 'var(--loss)' }}>{pcr}</strong></span>
                <span>Expiry: <strong style={{ color: 'var(--brand)' }}>{fmtExpiryLabel(activeExpiry)}</strong></span>
                <span style={{ marginLeft: 'auto' }}>Lot size: {underlying.lot}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ OI BAR CHART VIEW ══ */}
        {view === 'oi' && (
          <motion.div key="oi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 20 }}>Open Interest Distribution — {underlying.symbol} {fmtExpiryLabel(activeExpiry)}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chain.map((row, i) => {
                  const callPct = (row.callOI / maxOI) * 100;
                  const putPct  = (row.putOI  / maxOI) * 100;
                  return (
                    <motion.div key={row.strike} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, alignItems: 'center' }}>
                      {/* Call bar (right-aligned) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                        <span className="num" style={{ fontSize: 11, color: 'var(--tx-3)', minWidth: 40 }}>{fmt(row.callOI)}</span>
                        <div style={{ width: `${Math.max(callPct, 1)}%`, height: 20, background: row.isATM ? 'rgba(0,200,150,0.6)' : 'rgba(0,200,150,0.3)', borderRadius: '4px 0 0 4px', transition: 'width 0.5s ease' }} />
                      </div>
                      {/* Strike */}
                      <div style={{ textAlign: 'center', fontSize: row.isATM ? 13 : 11.5, fontWeight: row.isATM ? 800 : 600, color: row.isATM ? 'var(--brand)' : 'var(--tx-2)' }}>
                        {row.strike.toLocaleString('en-IN')}
                      </div>
                      {/* Put bar (left-aligned) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: `${Math.max(putPct, 1)}%`, height: 20, background: row.isATM ? 'rgba(255,77,106,0.6)' : 'rgba(255,77,106,0.3)', borderRadius: '0 4px 4px 0', transition: 'width 0.5s ease' }} />
                        <span className="num" style={{ fontSize: 11, color: 'var(--tx-3)', minWidth: 40 }}>{fmt(row.putOI)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(0,200,150,0.45)' }} /><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Call OI (bears sell here)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,77,106,0.45)' }} /><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Put OI (bulls buy here)</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(244,117,32,0.5)' }} /><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>ATM strike</span></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ IV SKEW VIEW ══ */}
        {view === 'pcr' && (
          <motion.div key="pcr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}>
              <div className="glass-card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 20 }}>IV Skew — Volatility Smile</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chain.map((row, i) => {
                    const moneyness = ((row.strike - spot) / spot * 100).toFixed(1);
                    return (
                      <div key={row.strike} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px', gap: 10, alignItems: 'center' }}>
                        <span className="num" style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 600 }}>{row.strike.toLocaleString('en-IN')}</span>
                        <div style={{ height: 6, borderRadius: 3, background: `rgba(0,200,150,${(row.callIV / 30).toFixed(2)})` }} />
                        <div style={{ height: 6, borderRadius: 3, background: `rgba(255,77,106,${(row.putIV / 30).toFixed(2)})` }} />
                        <span className="num" style={{ fontSize: 11, color: row.isATM ? 'var(--brand)' : 'var(--tx-3)' }}>{moneyness}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(0,200,150,0.5)' }} /><span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>Call IV</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(255,77,106,0.5)' }} /><span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>Put IV</span></div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 20 }}>Greeks Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { greek: 'Δ Delta',   desc: 'Rate of change of option price per ₹1 move in underlying', callVal: '0.52', putVal: '-0.48', color: '#22D3EE' },
                    { greek: 'Γ Gamma',   desc: 'Rate of change of Delta per ₹1 move', callVal: '0.0042', putVal: '0.0038', color: '#A78BFA' },
                    { greek: 'θ Theta',   desc: 'Time decay per day (₹ per lot)', callVal: '-48.2', putVal: '-52.6', color: '#F5A623' },
                    { greek: 'ν Vega',    desc: 'Sensitivity to 1% change in IV (₹ per lot)', callVal: '124', putVal: '118', color: '#00C896' },
                    { greek: 'ρ Rho',     desc: 'Sensitivity to 1% change in interest rate', callVal: '18.4', putVal: '-16.8', color: '#FF4D6A' },
                  ].map((g, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, borderLeft: `3px solid ${g.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: g.color, fontFamily: "'JetBrains Mono',monospace" }}>{g.greek}</span>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: 'var(--gain)', fontWeight: 700, marginBottom: 2 }}>CALL</div>
                            <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{g.callVal}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: 'var(--loss)', fontWeight: 700, marginBottom: 2 }}>PUT</div>
                            <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{g.putVal}</div>
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>{g.desc}</p>
                    </motion.div>
                  ))}
                </div>
                <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(244,117,32,0.06)', border: '1px solid var(--border-brand)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, marginBottom: 4 }}>ATM IV ({underlying.symbol})</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 900, color: 'var(--tx)' }}>{ivSkew?.callIV ?? '—'}%</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Implied Volatility at ATM strike</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Education strip ───────────────────────────────────── */}
      <motion.div custom={3} variants={cardV} initial="hidden" animate="visible">
        <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', background: 'rgba(167,139,250,0.04)', borderColor: 'rgba(167,139,250,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertCircle size={18} color="var(--purple)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>Options Disclaimer</div>
              <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>F&O trading involves substantial risk. Only SEBI-registered brokers can execute option trades. This is for informational purposes only.</div>
            </div>
          </div>
          <button onClick={() => navigate('/app/screener')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.1)', color: 'var(--purple)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Go to Screener
          </button>
        </div>
      </motion.div>

    </div>
  );
}
