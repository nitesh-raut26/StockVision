import { useMemo, useRef, useState } from 'react';
import Dropdown from '../components/ui/Dropdown';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight, TrendingUp, TrendingDown, Zap, Newspaper,
  BarChart2, Activity, RefreshCw, ChevronUp, ChevronDown,
  AlertCircle, Target, Brain, Plus, PieChart as PieIcon,
  TrendingUp as SipIcon, Globe,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { mockStocks, mockPortfolio, mockNews, generateChartData } from '../data/mockData';
import { useStore } from '../store/useStore';
import ConvictionBadge from '../components/ui/ConvictionBadge';
import { createTransaction, fetchPortfolioSummary, computePortfolioHealth } from '../lib/api';
import FiiDiiWidget from '../components/market/FiiDiiWidget';

/* ─── Static data ──────────────────────────────────────────────── */
const portfolioChartData = generateChartData(180, 3800000);

function IconDefence() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L3 5v5c0 4.12 2.99 7.97 7 9 4.01-1.03 7-4.88 7-9V5l-7-3z" fill="rgba(244,117,32,0.15)" stroke="var(--brand)" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7.5 10l1.8 1.8L12.5 8" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconPSU() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="15" width="3" height="3" rx="0.5" fill="var(--brand)" opacity="0.7"/>
      <rect x="6.5" y="11" width="3" height="7" rx="0.5" fill="var(--brand)" opacity="0.85"/>
      <rect x="11" y="7" width="3" height="11" rx="0.5" fill="var(--brand)"/>
      <rect x="15.5" y="3" width="3" height="15" rx="0.5" fill="var(--brand)" opacity="0.5"/>
      <path d="M3.5 15L8 11L12.5 7L17 3" stroke="var(--gain)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconIT() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="16" height="11" rx="2" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.7)" strokeWidth="1.3"/>
      <path d="M6 14v2M14 14v2M5 16h10" stroke="rgba(99,102,241,0.7)" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6 9.5l2-2 2 2 2-3 2 1.5" stroke="rgba(99,102,241,0.9)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconBudget() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="16" rx="2" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.7)" strokeWidth="1.3"/>
      <path d="M7 7h6M7 10h6M7 13h4" stroke="rgba(16,185,129,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="14.5" cy="14.5" r="3.5" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.9)" strokeWidth="1.2"/>
      <path d="M13.5 14.5h2M14.5 13.5v2" stroke="rgba(16,185,129,0.9)" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

const themes = [
  { label: 'Defence & Drones', sub: '14 stocks', change: '+3.2%', positive: true,  Icon: IconDefence },
  { label: 'PSU Reform',       sub: '22 stocks', change: '+1.8%', positive: true,  Icon: IconPSU     },
  { label: 'IT Recovery',      sub: '18 stocks', change: '-0.4%', positive: false, Icon: IconIT      },
  { label: 'Budget Plays',     sub: '31 stocks', change: '+2.6%', positive: true,  Icon: IconBudget  },
];

const sectorColors = ['#f47520','#2db562','#22d3ee','#a78bfa','#f59e0b','#e53935'];

const sipData = [
  { month: 'Dec', amount: 25000, value: 25400  },
  { month: 'Jan', amount: 25000, value: 51900  },
  { month: 'Feb', amount: 25000, value: 79200  },
  { month: 'Mar', amount: 25000, value: 107800 },
  { month: 'Apr', amount: 25000, value: 137400 },
  { month: 'May', amount: 25000, value: 168600 },
];

const heatmapStocks = [
  { ticker: 'HAL',      change: 3.4  },
  { ticker: 'BEL',      change: 2.1  },
  { ticker: 'RELIANCE', change: -0.8 },
  { ticker: 'TCS',      change: 1.2  },
  { ticker: 'HDFC',     change: -1.4 },
  { ticker: 'PAYTM',    change: -3.2 },
  { ticker: 'IDEAFRG',  change: 4.6  },
  { ticker: 'MTAR',     change: 0.7  },
];

const getHeatColor = (c: number) => {
  if (c >= 4)  return { bg: 'rgba(0,200,150,0.75)', tx: '#fff',    glow: 'rgba(0,200,150,0.4)' };
  if (c >= 2)  return { bg: 'rgba(0,200,150,0.35)', tx: '#00C896', glow: 'rgba(0,200,150,0.2)' };
  if (c >= 0)  return { bg: 'rgba(0,200,150,0.12)', tx: '#4ade80', glow: 'transparent' };
  if (c >= -2) return { bg: 'rgba(255,77,106,0.16)', tx: '#ff8fa3', glow: 'transparent' };
  return               { bg: 'rgba(255,77,106,0.55)', tx: '#fff',   glow: 'rgba(255,77,106,0.3)' };
};

const sentimentColor = (s: string) =>
  s.toLowerCase() === 'positive' ? 'var(--gain)' : s.toLowerCase() === 'negative' ? 'var(--loss)' : 'var(--tx-3)';

/* ─── Animation helpers ────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] },
});

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};

const cardVariant = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } },
};

/* ─── Sub-components ───────────────────────────────────────────── */
function StatBadge({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.03em' }}>{label}</p>
      <p className="num" style={{ fontSize: 15, fontWeight: 700, color: positive === undefined ? 'var(--tx)' : positive ? 'var(--gain)' : 'var(--loss)' }}>
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
      <div>
        <h2 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.01em', marginBottom: sub ? 2 : 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'opacity 150ms' }}>
          {action} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate  = useNavigate();
  const { user, authToken } = useStore();
  const queryClient = useQueryClient();
  const isMobile  = useIsMobile();
  const [activeRange, setActiveRange] = useState('1Y');
  const [tradeOpen, setTradeOpen] = useState(false);
  const connectedBrokers = [
    { label: 'Zerodha',   value: 'zerodha'   },
    { label: 'Groww',     value: 'groww'     },
    { label: 'Angel One', value: 'angelone'  },
  ];
  const [trade, setTrade] = useState({ ticker: 'RELIANCE', action: 'BUY' as 'BUY' | 'SELL', qty: 1, price: 2500, broker: 'zerodha' });
  const [tradeError, setTradeError] = useState<string | null>(null);

  const portfolioQuery = useQuery({
    queryKey: ['portfolio-summary', authToken],
    queryFn:  () => fetchPortfolioSummary(authToken),
  });
  const tradeMutation = useMutation({
    mutationFn: () => createTransaction(trade, authToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setTradeError(null);
      setTradeOpen(false);
    },
    onError: (err: unknown) => {
      setTradeError(err instanceof Error ? err.message : 'Trade failed — please try again.');
    },
  });

  const topPicks = useMemo(() => [...mockStocks].sort((a, b) => b.convictionScore - a.convictionScore).slice(0, 3), []);

  const holdings = useMemo(() => portfolioQuery.data?.holdings ?? mockPortfolio.holdings.map(h => ({
    ticker: h.ticker, name: h.name, qty: h.qty, avgPrice: h.avgPrice,
    currentPrice: h.currentPrice, currentValue: h.currentPrice * h.qty,
    pnl: h.pnl, pnlPct: h.pnlPct, broker: h.broker, sector: h.sector,
  })), [portfolioQuery.data]);

  const totalValue    = portfolioQuery.data?.totalValue    ?? holdings.reduce((s, h) => s + h.currentPrice * h.qty, 0);
  const totalInvested = portfolioQuery.data?.totalInvested ?? holdings.reduce((s, h) => s + h.avgPrice    * h.qty, 0);
  const totalGain     = totalValue - totalInvested;
  const gainPct       = totalInvested ? ((totalGain / totalInvested) * 100).toFixed(1) : '0.0';
  const todayPnL      = Math.round(totalGain * 0.015);

  const brokerBreakdown = portfolioQuery.data?.brokerBreakdown ?? [...new Set(holdings.map(h => h.broker))].map(broker => {
    const bh  = holdings.filter(h => h.broker === broker);
    const val = bh.reduce((s, h) => s + h.currentPrice * h.qty, 0);
    const inv = bh.reduce((s, h) => s + h.avgPrice    * h.qty, 0);
    return { broker, value: val, invested: inv, pnl: val - inv };
  });

  const rangeMap: Record<string, number> = { '1M': 30, '3M': 90, '1Y': 180, 'All': 180 };
  const chartSlice = portfolioChartData.slice(-(rangeMap[activeRange] ?? 180));

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isLive   = !!authToken;

  const newsRef    = useRef(null);
  const newsInView = useInView(newsRef, { once: true, margin: '-60px' });

  return (
    <motion.div initial="initial" animate="animate" variants={stagger}
      style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280 }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 19 : 23, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.025em', marginBottom: 4 }}>
            {greeting}, <span className="gradient-text">{user?.name?.split(' ')[0] ?? 'Investor'}</span>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;·&nbsp;{isLive ? 'Portfolio synced' : 'Demo portfolio active'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <motion.div whileHover={{ scale: 1.05 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: isLive ? 'rgba(0,200,150,0.08)' : 'rgba(245,166,35,0.08)', border: `1px solid ${isLive ? 'rgba(0,200,150,0.25)' : 'rgba(245,166,35,0.25)'}`, borderRadius: 10 }}>
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: isLive ? 'var(--gain)' : 'var(--gold)', display: 'inline-block', boxShadow: `0 0 6px ${isLive ? 'var(--gain)' : 'var(--gold)'}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? 'var(--gain)' : 'var(--gold)' }}>{isLive ? 'LIVE' : 'PREVIEW'}</span>
          </motion.div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setTradeOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={13} /> Add Trade
          </motion.button>
          {!isLive && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="btn-primary btn-glow" style={{ fontSize: 12.5, padding: '7px 16px', gap: 5 }}>
              <RefreshCw size={13} /> Connect Broker
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ── MARKET NEWS TICKER ─────────────────────────────── */}
      <motion.div {...fadeUp(0.08)}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'stretch', boxShadow: 'var(--shadow-card)' }}>
        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', background: 'var(--brand-dim)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
          <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#2db562', display: 'inline-block', boxShadow: '0 0 6px #2db562' }}/>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand)', whiteSpace: 'nowrap' }}>Market News</span>
        </div>
        {/* Scrolling ticker */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ repeat: Infinity, duration: 38, ease: 'linear' }}
            style={{ display: 'flex', alignItems: 'center', gap: 0, whiteSpace: 'nowrap', padding: '11px 0' }}>
            {[...mockNews, ...mockNews].map((n, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, paddingRight: 36 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                  background: n.sentiment?.toLowerCase() === 'positive' ? 'rgba(0,200,150,0.12)' : n.sentiment?.toLowerCase() === 'negative' ? 'rgba(255,77,106,0.12)' : 'var(--surface-mid)',
                  color: n.sentiment?.toLowerCase() === 'positive' ? '#00C896' : n.sentiment?.toLowerCase() === 'negative' ? '#FF4D6A' : 'var(--tx-3)' }}>
                  {n.sentiment ?? 'NEUTRAL'}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--tx-2)', fontWeight: 500 }}>{n.headline}</span>
                <span style={{ color: 'var(--border-md)', fontSize: 14, marginLeft: 8 }}>·</span>
              </span>
            ))}
          </motion.div>
          {/* Fade edges using CSS vars */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 40, height: '100%', background: 'var(--fade-l)', pointerEvents: 'none' }}/>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 40, height: '100%', background: 'var(--fade-r)', pointerEvents: 'none' }}/>
        </div>
        {/* View all */}
        <button onClick={() => navigate('/app/research')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 16px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'opacity 150ms' }}>
          All News →
        </button>
      </motion.div>

      {/* ── PORTFOLIO + BROKER ROW ─────────────────────────── */}
      <div className="dashboard-primary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 18 }}>

        {/* Portfolio card */}
        <motion.div variants={cardVariant} className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Total Portfolio Value</p>
              <motion.p className="num"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
                style={{ fontSize: 38, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                ₹{(totalValue / 100000).toFixed(2)}L
              </motion.p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <motion.span className="num" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  style={{ fontSize: 14, fontWeight: 700, color: totalGain >= 0 ? 'var(--gain)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {totalGain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {totalGain >= 0 ? '+' : ''}₹{Math.abs(totalGain / 100000).toFixed(1)}L
                </motion.span>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', background: totalGain >= 0 ? 'rgba(0,200,150,0.12)' : 'rgba(255,77,106,0.12)', color: totalGain >= 0 ? 'var(--gain)' : 'var(--loss)', borderRadius: 7 }}>
                  {totalGain >= 0 ? '+' : ''}{gainPct}%
                </span>
                <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>all time</span>
              </div>
            </div>
            {/* Range buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              {['1M', '3M', '1Y', 'All'].map(t => (
                <button key={t} onClick={() => setActiveRange(t)}
                  style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: t === activeRange ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: t === activeRange ? 'var(--brand-dim)' : 'transparent', color: t === activeRange ? 'var(--brand)' : 'var(--tx-3)', cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={chartSlice} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f47520" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f47520" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 12, color: 'var(--tx)' }}
                  formatter={(v: unknown) => [`₹${(Number(v) / 100000).toFixed(2)}L`, 'Value']} labelFormatter={() => ''} />
                <Area type="monotone" dataKey="price" stroke="#f47520" strokeWidth={2.5} fill="url(#portGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 28, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <StatBadge label="Invested"    value={`₹${(totalInvested / 100000).toFixed(1)}L`} />
            <StatBadge label="Today's P&L" value={`${todayPnL >= 0 ? '+' : '-'}₹${Math.abs(todayPnL).toLocaleString('en-IN')}`} positive={todayPnL >= 0} />
            <StatBadge label="XIRR"        value={portfolioQuery.data?.xirr ? `${portfolioQuery.data.xirr.toFixed(1)}%` : '18.4%'} positive />
            <StatBadge label="Holdings"    value={`${holdings.length}`} />
          </div>
        </motion.div>

        {/* Broker breakdown */}
        <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 18 }}>Broker Breakdown</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {brokerBreakdown.map((b, i) => {
              const pct = totalValue ? ((b.value / totalValue) * 100) : 0;
              const colors = ['#f47520', '#22D3EE', '#2db562', '#F5A623', '#A78BFA'];
              const col = colors[i % colors.length];
              return (
                <motion.div key={b.broker} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.08 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>{b.broker}</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>₹{(b.value / 100000).toFixed(1)}L</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--surface-high)', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.7, ease: 'easeOut' }}
                      style={{ height: '100%', background: col, borderRadius: 99, boxShadow: `0 0 8px ${col}66` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{pct.toFixed(0)}% of portfolio</span>
                    <span className="num" style={{ fontSize: 11, color: b.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                      {b.pnl >= 0 ? '+' : ''}₹{Math.abs(b.pnl / 1000).toFixed(0)}K
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <motion.button whileHover={{ scale: 1.02, borderColor: 'var(--border-brand)' }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/settings')}
            style={{ width: '100%', marginTop: 18, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 12, background: 'transparent', color: 'var(--tx-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
            <Activity size={13} /> Connect more brokers
          </motion.button>
        </motion.div>
      </div>

      {/* ── PORTFOLIO HEALTH SCORE ─────────────────────────── */}
      {(() => {
        const health = computePortfolioHealth(holdings);
        const gradeColor = health.grade === 'A' ? '#10b981' : health.grade === 'B' ? 'var(--brand)' : health.grade === 'C' ? 'var(--gold)' : 'var(--loss)';
        return (
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Score ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke={gradeColor} strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - health.score / 100)}`}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 800ms ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span className="num" style={{ fontSize: 14, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{health.grade}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Portfolio Health</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx)', lineHeight: 1 }}>{health.score}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-3)' }}>/100</span></div>
              </div>
            </div>
            {/* Score bar */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${health.score}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  style={{ height: '100%', background: `linear-gradient(90deg, ${gradeColor}99, ${gradeColor})`, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {health.insights.map((insight, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <Brain size={11} color={gradeColor} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => navigate('/app/screener')}
              style={{ padding: '9px 18px', borderRadius: 'var(--r-sm)', background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Improve Score
            </button>
          </motion.div>
        );
      })()}

      {/* ── AI TOP PICKS ───────────────────────────────────── */}
      <motion.div variants={cardVariant}>
        <SectionHeader title="AI Top Picks Today" sub="Highest conviction scores across NSE/BSE" action="Full screener" onAction={() => navigate('/app/screener')} />
        <motion.div initial="initial" animate="animate" variants={stagger}
          className="dashboard-top-picks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {topPicks.map((stock, i) => {
            const positive  = stock.changePct >= 0;
            const chartData = generateChartData(30, stock.price * 0.9);
            const accentMap = ['#f47520', '#2db562', '#A78BFA'];
            const accent = accentMap[i] ?? 'var(--brand)';
            return (
              <motion.div key={stock.ticker} variants={cardVariant}
                whileHover={{ y: -5, boxShadow: `0 16px 40px rgba(0,0,0,0.15), 0 0 0 1px ${accent}33` }}
                className="glass-card" style={{ padding: 22, cursor: 'pointer', transition: 'box-shadow 250ms, transform 250ms' }}
                onClick={() => navigate(`/app/stock/${stock.ticker}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)' }}>{stock.ticker}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', background: `${accent}15`, color: accent, borderRadius: 99, border: `1px solid ${accent}25` }}>{stock.sector}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--tx-3)', maxWidth: 160, lineHeight: 1.5 }}>{stock.name}</p>
                  </div>
                  <ConvictionBadge score={stock.convictionScore} size="md" />
                </div>

                <div style={{ height: 60, marginBottom: 14 }}>
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id={`cg${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={positive ? '#00C896' : '#FF4D6A'} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={positive ? '#00C896' : '#FF4D6A'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="price" stroke={positive ? 'var(--gain)' : 'var(--loss)'} strokeWidth={1.5} fill={`url(#cg${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)' }}>₹{stock.price.toLocaleString('en-IN')}</span>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: positive ? 'var(--gain)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 2 }}>
                    {positive ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {Math.abs(stock.changePct).toFixed(2)}%
                  </span>
                </div>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600 }}>12M Target</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>₹{stock.target12m.toLocaleString('en-IN')} (+{stock.upside}%)</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* ── HOLDINGS TABLE ─────────────────────────────────── */}
      <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
        <SectionHeader title="My Holdings" sub={`${holdings.length} positions`} action="Full portfolio" onAction={() => navigate('/app/screener')} />
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              {['Stock', 'Qty', 'Avg Price', 'LTP', 'Invested', 'Current', 'P&L', 'Broker'].map(h => (
                <th key={h} style={{ textAlign: h === 'Stock' || h === 'Broker' ? 'left' : 'right', padding: '10px 14px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.slice(0, 6).map((h, i) => (
              <motion.tr key={h.ticker} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/app/stock/${h.ticker}`)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '13px 14px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--tx)', fontSize: 13.5 }}>{h.ticker}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{h.name}</span>
                </td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 13 }}>{h.qty}</td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 13 }}>₹{h.avgPrice.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 13, fontWeight: 600 }}>₹{h.currentPrice.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 13, color: 'var(--tx-3)' }}>₹{(h.avgPrice * h.qty / 1000).toFixed(0)}K</td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontSize: 13 }}>₹{(h.currentValue / 1000).toFixed(0)}K</td>
                <td className="num" style={{ textAlign: 'right', padding: '13px 14px', fontWeight: 700, fontSize: 13, color: h.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                  {h.pnl >= 0 ? '+' : ''}₹{(h.pnl / 1000).toFixed(0)}K
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%)</span>
                </td>
                <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', background: 'var(--brand-dim)', color: 'var(--brand)', borderRadius: 6 }}>{h.broker}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
      </motion.div>

      {/* ── THEMES + HEATMAP + NEWS ────────────────────────── */}
      <div className="dashboard-secondary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: 18 }}>

        {/* Trending themes */}
        <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={14} color="var(--gold)" />
            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Trending Themes</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {themes.map((t, i) => (
              <motion.div key={t.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                whileHover={{ x: 4, background: 'var(--bg-hover)' }}
                onClick={() => navigate('/app/screener')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-low)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', flexShrink: 0 }}><t.Icon /></div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{t.label}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{t.sub}</p>
                  </div>
                </div>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: t.positive ? 'var(--gain)' : 'var(--loss)' }}>{t.change}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Mini heatmap */}
        <motion.div variants={cardVariant} className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BarChart2 size={13} color="var(--tx-3)" />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Heatmap</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
            {heatmapStocks.map((s, i) => {
              const { bg, tx, glow } = getHeatColor(s.change);
              return (
                <motion.div key={s.ticker} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.06, boxShadow: `0 0 12px ${glow}` }}
                  onClick={() => navigate('/app/heatmap')}
                  style={{ background: bg, borderRadius: 7, padding: '10px 6px', cursor: 'pointer', textAlign: 'center', transition: 'box-shadow 200ms' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: tx }}>{s.ticker}</p>
                  <p className="num" style={{ fontSize: 9.5, color: tx, marginTop: 2 }}>
                    {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                  </p>
                </motion.div>
              );
            })}
          </div>
          <motion.button whileHover={{ background: 'var(--brand-dim)', borderColor: 'var(--border-brand)' }}
            onClick={() => navigate('/app/heatmap')}
            style={{ width: '100%', padding: '8px 0', border: '1px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--tx-3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}>
            Full Heatmap
          </motion.button>
        </motion.div>

        {/* News feed */}
        <motion.div ref={newsRef} variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Newspaper size={14} color="var(--tx-3)" />
            <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Market News</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {mockNews.slice(0, 5).map((news, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={newsInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.08 }}
                style={{ paddingBottom: 13, marginBottom: 13, borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: sentimentColor(news.sentiment), padding: '2px 7px', background: `${sentimentColor(news.sentiment)}18`, borderRadius: 99 }}>{news.sentiment}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{news.source}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', marginLeft: 'auto' }}>{news.time}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.55, fontWeight: 500 }}>{news.headline}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── AI SIGNAL BANNER ───────────────────────────────── */}
      <motion.div variants={cardVariant}
        style={{ padding: isMobile ? '16px 18px' : '20px 28px', borderRadius: 'var(--r-lg)', background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 14 : 18, cursor: 'pointer', flexDirection: isMobile ? 'column' : 'row' }}
        whileHover={{ borderColor: 'var(--brand)', boxShadow: '0 0 24px var(--brand-glow)' }}
        onClick={() => navigate('/app/screener')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Brain size={20} color="var(--brand)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>3 new AI signals for your watchlist</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              HAL (BUY · 94%), HDFC Bank (HOLD · 78%), Infosys (BUY · 82%) — 2h ago
            </div>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--brand)', flexShrink: 0 }}>
              View signals <ArrowRight size={14} />
            </div>
          )}
        </div>
        {isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[{label:'HAL',action:'BUY',color:'var(--gain)'},{label:'HDFC',action:'HOLD',color:'var(--gold)'},{label:'INFY',action:'BUY',color:'var(--gain)'}].map(s => (
              <div key={s.label} style={{ padding: '4px 10px', background: `${s.color === 'var(--gain)' ? 'rgba(0,200,150,0.12)' : 'rgba(245,166,35,0.12)'}`, border: `1px solid ${s.color === 'var(--gain)' ? 'rgba(0,200,150,0.3)' : 'rgba(245,166,35,0.3)'}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx)' }}>{s.label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color }}>{s.action}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>
              View <ArrowRight size={12} />
            </div>
          </div>
        )}
      </motion.div>

      {tradeOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: '20px 20px 18px', boxSizing: 'border-box', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', marginBottom: 3 }}>Add Trade</h3>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.4 }}>{authToken ? 'Updates your live portfolio ledger.' : 'Sign in to persist trades to your ledger.'}</p>
              </div>
              <button onClick={() => { setTradeOpen(false); setTradeError(null); }} style={{ border: 'none', background: 'transparent', color: 'var(--tx-3)', fontSize: 20, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '2px 4px' }}>×</button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Ticker */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.05em' }}>
                TICKER
                <input
                  value={trade.ticker}
                  onChange={e => setTrade({ ...trade, ticker: e.target.value.toUpperCase() })}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </label>

              {/* Action + Broker */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 0 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.05em', minWidth: 0 }}>
                  ACTION
                  <Dropdown
                    options={[{ label: 'BUY', value: 'BUY' }, { label: 'SELL', value: 'SELL' }]}
                    value={trade.action}
                    onChange={v => setTrade({ ...trade, action: v as 'BUY' | 'SELL' })}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.05em', minWidth: 0 }}>
                  BROKER
                  <Dropdown
                    options={connectedBrokers}
                    value={trade.broker}
                    onChange={v => setTrade({ ...trade, broker: v })}
                  />
                </label>
              </div>

              {/* Qty + Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 0 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.05em', minWidth: 0 }}>
                  QTY
                  <input
                    type="number" min={1} value={trade.qty}
                    onChange={e => setTrade({ ...trade, qty: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.05em', minWidth: 0 }}>
                  PRICE (₹)
                  <input
                    type="number" min={1} value={trade.price}
                    onChange={e => setTrade({ ...trade, price: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }}
                  />
                </label>
              </div>

              {/* Total preview */}
              {trade.qty > 0 && trade.price > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'var(--brand-dim)', border: '1px solid rgba(244,117,32,0.2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Total Value</span>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>₹{(trade.qty * trade.price).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Error */}
            {tradeError && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.25)', fontSize: 12, color: 'var(--loss)', lineHeight: 1.5 }}>
                {tradeError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setTradeOpen(false); setTradeError(null); }}
                style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', borderRadius: 8, padding: '9px 0', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button disabled={!authToken || tradeMutation.isPending} onClick={() => tradeMutation.mutate()}
                style={{ border: 'none', background: trade.action === 'BUY' ? 'var(--gain)' : 'var(--loss)', color: '#fff', borderRadius: 8, padding: '9px 0', fontWeight: 800, cursor: authToken ? 'pointer' : 'not-allowed', opacity: authToken ? 1 : 0.55, fontSize: 13, fontFamily: 'inherit' }}>
                {tradeMutation.isPending ? 'Saving…' : `${trade.action} ${trade.ticker || '—'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FII/DII FLOW + SECTOR ALLOCATION ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 18 }}>

        {/* FII/DII Daily Flow — live widget */}
        <FiiDiiWidget />

        {/* Sector Allocation */}
        <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <PieIcon size={14} color="var(--brand)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Sector Allocation</h3>
          </div>
          {(() => {
            const sectorMap: Record<string, number> = {};
            holdings.forEach(h => {
              const s = (h as any).sector ?? 'Other';
              sectorMap[s] = (sectorMap[s] ?? 0) + h.currentValue;
            });
            const total = Object.values(sectorMap).reduce((a, b) => a + b, 0);
            const data = Object.entries(sectorMap).map(([name, value]) => ({ name, value, pct: total ? value / total * 100 : 0 }));
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <PieChart width={140} height={140}>
                    <Pie data={data} dataKey="value" cx={70} cy={70} innerRadius={38} outerRadius={60} strokeWidth={0}>
                      {data.map((_, i) => <Cell key={i} fill={sectorColors[i % sectorColors.length]} />)}
                    </Pie>
                  </PieChart>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sectorColors[i % sectorColors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: 'var(--tx-2)', flex: 1 }}>{s.name}</span>
                      <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </motion.div>
      </div>

      {/* ── SIP TRACKER ────────────────────────────────────── */}
      <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SipIcon size={14} color="var(--gain)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>SIP Tracker</h3>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Monthly SIP', value: '₹25,000', color: 'var(--tx)' },
              { label: 'Invested', value: `₹${(sipData.length * 25000 / 1000).toFixed(0)}K`, color: 'var(--tx-2)' },
              { label: 'Current Value', value: `₹${(sipData[sipData.length-1].value / 1000).toFixed(1)}K`, color: 'var(--gain)' },
              { label: 'Gain', value: `+${(((sipData[sipData.length-1].value - sipData.length * 25000) / (sipData.length * 25000)) * 100).toFixed(1)}%`, color: 'var(--gain)' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 2 }}>{s.label}</p>
                <p className="num" style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
            <AreaChart data={sipData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sipGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2db562" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2db562" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sipInvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={46}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown, name?: unknown) => [`₹${(v as number).toLocaleString('en-IN')}`, name === 'value' ? 'Portfolio Value' : 'Cumulative Invested']} />
              <Area type="monotone" dataKey="value" stroke="#2db562" strokeWidth={2} fill="url(#sipGrad)" dot={{ fill: '#2db562', r: 3 }} />
              <Area type="monotone" dataKey="amount" name="amount" stroke="var(--brand)" strokeWidth={1.5} fill="url(#sipInvGrad)" strokeDasharray="5 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          {[{ label: 'Portfolio Value', color: '#2db562' }, { label: 'Cumulative SIP', color: 'var(--brand)' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }} />
              <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── QUICK ACTIONS ─────────────────────────────────── */}
      <motion.div variants={cardVariant}>
        <SectionHeader title="Quick Actions" />
        <div className="quick-actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { icon: BarChart2,   label: 'Run Screener',   sub: 'Find top stocks',   path: '/app/screener',  color: 'var(--brand)' },
            { icon: Target,      label: 'DCF Valuation',  sub: 'Build a model',     path: '/app/dcf',       color: 'var(--cyan)'  },
            { icon: AlertCircle, label: 'Tax Tracker',    sub: 'Harvest losses',    path: '/app/tax',       color: 'var(--gold)'  },
            { icon: Activity,    label: 'Market Heatmap', sub: 'Sector overview',   path: '/app/heatmap',   color: 'var(--gain)'  },
            { icon: Globe,       label: 'Options Chain',  sub: 'F&O analytics',     path: '/app/options',   color: '#a78bfa'      },
            { icon: SipIcon,     label: 'IPO Tracker',    sub: 'New listings',      path: '/app/ipo',       color: '#22d3ee'      },
            { icon: Brain,       label: 'Backtesting',    sub: 'Test strategies',   path: '/app/backtest',  color: '#f59e0b'      },
          ].map((a, i) => (
            <motion.button key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
              whileHover={{ y: -3, boxShadow: 'var(--shadow-elevated)' }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate(a.path)}
              className="glass-card"
              style={{ padding: '18px 20px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'box-shadow 250ms, transform 250ms', fontFamily: 'inherit' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-mid)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <a.icon size={17} color={a.color} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>{a.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{a.sub}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}
