import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Bookmark, BarChart3, GitCompare,
  Volume2, ChevronRight, Activity, Target, AlertCircle, DollarSign,
  Zap, Wifi, WifiOff,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import {
  Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { mockStocks, mockNews, generateChartData } from '../data/mockData';
import { useStore } from '../store/useStore';
import ConvictionBadge from '../components/ui/ConvictionBadge';
import SystemStatus from '../components/ui/SystemStatus';
import ConvictionFactors from '../components/ui/ConvictionFactors';
import { fetchStockDetails, fetchIncomeStatement, fetchAnalystTargets, fetchStockNews, fetchConvictionExplain, buildFactorWaterfall, demoConvictionFactors, type IncomeStatementRow } from '../lib/api';
import TradingViewChart, { pushTick } from '../components/charts/TradingViewChart';
import type { AreaPoint } from '../components/charts/TradingViewChart';
import type { ISeriesApi } from 'lightweight-charts';
import { useMarketWebSocket } from '../hooks/useMarketWebSocket';

/* ─── Indicator math ─────────────────────────────────────────── */
function calcEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const ema: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * k + (ema[i - 1] as number) * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  let ag = gains / period, al = losses / period;
  rsi[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return rsi;
}

function calcMACD(prices: number[]) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine: (number | null)[] = prices.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  const valid = macdLine.filter(v => v !== null) as number[];
  const sigValid = calcEMA(valid, 9);
  const signal: (number | null)[] = new Array(prices.length).fill(null);
  let si = 0;
  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] !== null) { signal[i] = sigValid[si]; si++; }
  }
  const hist: (number | null)[] = prices.map((_, i) =>
    macdLine[i] !== null && signal[i] !== null
      ? (macdLine[i] as number) - (signal[i] as number) : null
  );
  return { macdLine, signal, hist };
}

function calcBB(prices: number[], period = 20, mult = 2) {
  const middle: (number | null)[] = prices.map((_, i) => {
    if (i < period - 1) return null;
    const sl = prices.slice(i - period + 1, i + 1);
    return sl.reduce((a, b) => a + b, 0) / period;
  });
  const upper: (number | null)[] = prices.map((_, i) => {
    if (middle[i] === null) return null;
    const sl = prices.slice(i - period + 1, i + 1);
    const avg = middle[i] as number;
    const sd = Math.sqrt(sl.reduce((s, p) => s + (p - avg) ** 2, 0) / period);
    return avg + mult * sd;
  });
  const lower: (number | null)[] = prices.map((_, i) => {
    if (middle[i] === null) return null;
    const sl = prices.slice(i - period + 1, i + 1);
    const avg = middle[i] as number;
    const sd = Math.sqrt(sl.reduce((s, p) => s + (p - avg) ** 2, 0) / period);
    return avg - mult * sd;
  });
  return { middle, upper, lower };
}

function calcStoch(prices: number[], k = 14, d = 3) {
  const pctK: (number | null)[] = prices.map((_, i) => {
    if (i < k - 1) return null;
    const sl = prices.slice(i - k + 1, i + 1);
    const hi = Math.max(...sl), lo = Math.min(...sl);
    return hi === lo ? 50 : ((prices[i] - lo) / (hi - lo)) * 100;
  });
  const pctD: (number | null)[] = pctK.map((_, i) => {
    if (i < k - 1 + d - 1) return null;
    const sl = pctK.slice(i - d + 1, i + 1).filter(v => v !== null) as number[];
    return sl.length === d ? sl.reduce((a, b) => a + b, 0) / d : null;
  });
  return { pctK, pctD };
}

function calcATR(prices: number[], period = 14): number {
  if (prices.length < 2) return 0;
  const trs = prices.slice(1).map((p, i) => Math.abs(p - prices[i]));
  const recent = trs.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function calcOBV(prices: number[], volumes: number[]): number[] {
  const obv = [0];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (prices[i] < prices[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

function calcWilliamsR(prices: number[], period = 14): (number | null)[] {
  return prices.map((p, i) => {
    if (i < period - 1) return null;
    const sl = prices.slice(i - period + 1, i + 1);
    const hi = Math.max(...sl), lo = Math.min(...sl);
    return hi === lo ? -50 : ((hi - p) / (hi - lo)) * -100;
  });
}

function calcCCI(prices: number[], period = 20): (number | null)[] {
  return prices.map((p, i) => {
    if (i < period - 1) return null;
    const sl = prices.slice(i - period + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / period;
    const md = sl.reduce((s, x) => s + Math.abs(x - mean), 0) / period;
    return md === 0 ? 0 : (p - mean) / (0.015 * md);
  });
}

const timeframes = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

const analystTargets = [
  { firm: 'ICICI Securities', analyst: 'Anshu Agarwal', target: 750, upside: 53.9, rating: 'Buy',  date: 'May 2026' },
  { firm: 'Kotak Equities',   analyst: 'Sanjeev Kumar', target: 680, upside: 39.5, rating: 'Buy',  date: 'Apr 2026' },
  { firm: 'HDFC Securities',  analyst: 'Nilesh Jain',   target: 600, upside: 23.1, rating: 'Hold', date: 'Mar 2026' },
];

const qData = [
  { q: 'Q1FY24', rev: 218600, ebitda: 38400, pat: 19400, eps: 28.6 },
  { q: 'Q2FY24', rev: 232100, ebitda: 41200, pat: 21200, eps: 31.3 },
  { q: 'Q3FY24', rev: 241800, ebitda: 43800, pat: 22800, eps: 33.6 },
  { q: 'Q4FY24', rev: 256300, ebitda: 47100, pat: 24600, eps: 36.3 },
  { q: 'Q1FY25', rev: 263500, ebitda: 48900, pat: 25800, eps: 38.0 },
  { q: 'Q2FY25', rev: 271200, ebitda: 51400, pat: 27100, eps: 40.0 },
];

// Map a backend income-statement row (₹ crore) → the quarterly chart shape.
function mapIncomeRow(d: IncomeStatementRow) {
  return {
    q:      d.period_label,
    rev:    Math.round(d.revenue ?? 0),
    ebitda: Math.round(d.ebitda ?? 0),
    pat:    Math.round(d.pat ?? 0),
    eps:    d.eps_basic ?? d.eps_diluted ?? 0,
  };
}

const ratingStyle = (r: string) =>
  r === 'Buy'  ? { bg: 'rgba(45,181,98,0.12)',  color: 'var(--gain)' } :
  r === 'Sell' ? { bg: 'rgba(229,57,53,0.12)',   color: 'var(--loss)' } :
                 { bg: 'rgba(245,166,35,0.12)',  color: 'var(--gold)' };

const cardVariant = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } },
};

/* Custom tooltip for the price chart */
function PriceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-elevated)' }}>
      <p style={{ color: 'var(--tx-3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, color: 'var(--tx)', fontFamily: "'JetBrains Mono',monospace" }}>
        ₹{Number(payload[0].value).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

export default function StockDetail() {
  const { ticker }  = useParams<{ ticker: string }>();
  const navigate    = useNavigate();
  const isMobile    = useIsMobile();
  const { watchlist, addToWatchlist, removeFromWatchlist } = useStore();
  const [timeframe, setTimeframe]       = useState('3M');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [qMetric, setQMetric]           = useState<'rev' | 'ebitda' | 'pat' | 'eps'>('rev');
  const [indicatorTab, setIndicatorTab] = useState<'RSI' | 'MACD' | 'Bollinger' | 'Summary'>('RSI');

  const detailQuery = useQuery({
    queryKey: ['stock-detail', ticker],
    queryFn: () => fetchStockDetails(ticker ?? 'HAL'),
  });

  // Quarterly financials from /financials/{ticker}/income (demo figures offline)
  const financialsQuery = useQuery({
    queryKey: ['financials', ticker],
    queryFn: () => fetchIncomeStatement(ticker ?? 'HAL'),
  });
  const qDataLive: typeof qData = financialsQuery.data && financialsQuery.data.length
    ? (financialsQuery.data.slice(-6).map(mapIncomeRow) as unknown as typeof qData)
    : qData;
  const finLive = Boolean(financialsQuery.data && financialsQuery.data.length);

  const stock      = detailQuery.data?.stock ?? mockStocks.find(s => s.ticker === ticker) ?? mockStocks[0];
  const inWatchlist = watchlist.includes(stock.ticker);

  const chartData = useMemo(() => {
    const available = detailQuery.data?.history ?? [];
    if (!available.length) {
      const days = timeframe === '1D' ? 78 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '1Y' ? 365 : 1825;
      return generateChartData(days, stock.price);
    }
    const pts = timeframe === '1D' ? 78 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '1Y' ? 365 : available.length;
    return available.slice(-pts);
  }, [detailQuery.data?.history, stock.price, timeframe]);

  /* ─── Indicator base data — always 90+ points for accuracy ──── */
  const indicatorBase = useMemo(() => {
    const available = detailQuery.data?.history ?? [];
    if (!available.length) return generateChartData(120, stock.price);
    return available.length >= 90 ? available.slice(-120) : generateChartData(120, stock.price);
  }, [detailQuery.data?.history, stock.price]);

  const stockNews = mockNews.filter(n => n.ticker === stock.ticker || n.sector === stock.sector).slice(0, 4);

  // Analyst targets + news from /stocks/{ticker}/analysts|news (demo fallback)
  const analystsQuery = useQuery({ queryKey: ['analysts', ticker], queryFn: () => fetchAnalystTargets(ticker ?? 'HAL') });
  const analystData = analystsQuery.data ?? analystTargets;
  const analystsLive = Boolean(analystsQuery.data);

  const newsQuery = useQuery({ queryKey: ['stock-news', ticker], queryFn: () => fetchStockNews(ticker ?? 'HAL') });
  const explainQuery = useQuery({ queryKey: ['conviction-explain', ticker], queryFn: () => fetchConvictionExplain(ticker ?? 'HAL') });
  const newsData: typeof stockNews = (newsQuery.data as unknown as typeof stockNews) ?? stockNews;
  const newsLive = Boolean(newsQuery.data);

  /* ─── Technical indicator data ──────────────────────────────── */
  const indicators = useMemo(() => {
    const prices  = indicatorBase.map((d: any) => d.price as number);
    const volumes = indicatorBase.map((d: any) => (d.volume as number) ?? 100000);

    const rsiVals = calcRSI(prices);
    const { macdLine, signal, hist } = calcMACD(prices);
    const { middle: bbMid, upper: bbUpper, lower: bbLower } = calcBB(prices);
    const ema20 = calcEMA(prices, 20);
    const ema50 = calcEMA(prices, 50);
    const { pctK, pctD } = calcStoch(prices);
    const obvVals = calcOBV(prices, volumes);
    const williamsR = calcWilliamsR(prices);
    const cciVals   = calcCCI(prices);

    const last = prices.length - 1;

    const rsiData = indicatorBase.map((d: any, i: number) => ({
      date: d.date, rsi: rsiVals[i] !== null ? +((rsiVals[i] as number).toFixed(2)) : null,
    }));
    const macdData = indicatorBase.map((d: any, i: number) => ({
      date: d.date,
      macd: macdLine[i] !== null ? +((macdLine[i] as number).toFixed(2)) : null,
      signal: signal[i] !== null ? +((signal[i] as number).toFixed(2)) : null,
      hist: hist[i] !== null ? +((hist[i] as number).toFixed(2)) : null,
    }));
    const bbData = indicatorBase.map((d: any, i: number) => ({
      date: d.date,
      price: (d as any).price,
      upper: bbUpper[i] !== null ? +(( bbUpper[i] as number).toFixed(2)) : null,
      middle: bbMid[i]  !== null ? +((bbMid[i]   as number).toFixed(2)) : null,
      lower: bbLower[i] !== null ? +((bbLower[i]  as number).toFixed(2)) : null,
    }));

    const curRSI = rsiVals[last];
    const curMACD = macdLine[last];
    const curSignal = signal[last];
    const curEMA20 = ema20[last];
    const curEMA50 = ema50[last];
    const curK = pctK[last];
    const curD = pctD[last];
    const atr = calcATR(prices);
    const curOBV = obvVals[last];
    const curWR = williamsR[last];
    const curCCI = cciVals[last];

    return {
      rsiData, macdData, bbData,
      curRSI, curMACD, curSignal, curEMA20, curEMA50,
      curK, curD, atr, curOBV, curWR, curCCI,
    };
  }, [indicatorBase]);

  const convictionBreakdown = detailQuery.data?.breakdown ?? [
    { name: 'Fundamentals', value: 38, color: '#f47520' },
    { name: 'Technicals',   value: 32, color: '#2db562' },
    { name: 'Sentiment',    value: 30, color: '#22d3ee' },
  ];

  const handleAudio = () => { setAudioPlaying(true); setTimeout(() => setAudioPlaying(false), 4000); };
  const positive    = stock.changePct >= 0;
  const chartColor  = positive ? '#2db562' : '#e53935';

  /* ─── TradingView chart refs ─────────────────────────────────── */
  const tvSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  /* ─── Real-time WebSocket prices ─────────────────────────────── */
  const { prices: wsPrices, connected: wsConnected } = useMarketWebSocket(
    ticker ? [ticker] : [],
    true,
  );

  /* ─── Transform chartData → AreaPoint[] for TradingViewChart ─── */
  const tvChartData = useMemo<AreaPoint[]>(() =>
    chartData
      .map((d: any) => ({ time: d.date as string, value: d.price as number }))
      .filter((d: AreaPoint) => Boolean(d.time) && Boolean(d.value)),
    [chartData],
  );

  /* ─── Push live ticks to chart (O(1), no React re-render) ─────── */
  useEffect(() => {
    if (!tvSeriesRef.current || !ticker) return;
    const tick = wsPrices[ticker];
    if (!tick?.price) return;

    // Normalise timestamp: WebSocket ts may be seconds or milliseconds
    const ms  = tick.ts > 1e10 ? tick.ts : tick.ts * 1000;
    const day = new Date(ms).toISOString().split('T')[0]; // 'YYYY-MM-DD'
    pushTick(tvSeriesRef.current as any, { time: day, value: tick.price });
  }, [wsPrices, ticker]);

  /* Derive min/max for price range display */
  const prices     = chartData.map((d: any) => d.price).filter(Boolean);
  const priceMin   = prices.length ? Math.min(...prices) : 0;
  const priceMax   = prices.length ? Math.max(...prices) : 0;
  const priceRange = priceMax - priceMin;

  return (
    <motion.div initial="initial" animate="animate"
      style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400, width: '100%' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tx-3)' }}>
        <button onClick={() => navigate('/app/screener')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-3)')}>Screener</button>
        <ChevronRight size={13} />
        <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{stock.ticker}</span>
      </div>

      {/* Stock header */}
      <motion.div variants={cardVariant} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <ConvictionBadge score={stock.convictionScore} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 6 }}>{stock.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>{stock.ticker}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--brand-dim)', color: 'var(--brand)', border: '1px solid var(--border-brand)' }}>{stock.sector}</span>
              {stock.volumeSpike && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,166,35,0.12)', color: 'var(--gold)', border: '1px solid rgba(245,166,35,0.3)' }}>Volume Spike</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="num" style={{ fontSize: isMobile ? 28 : 34, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-0.02em' }}>₹{stock.price.toLocaleString('en-IN')}</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 700, color: positive ? 'var(--gain)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {positive ? '+' : ''}{stock.change} ({positive ? '+' : ''}{stock.changePct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => inWatchlist ? removeFromWatchlist(stock.ticker) : addToWatchlist(stock.ticker)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: inWatchlist ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: inWatchlist ? 'var(--brand-dim)' : 'var(--bg-card)', color: inWatchlist ? 'var(--brand)' : 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Bookmark size={14} fill={inWatchlist ? 'currentColor' : 'none'} />
            {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
          </motion.button>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={handleAudio}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: audioPlaying ? '1px solid rgba(245,166,35,0.5)' : '1px solid var(--border)', background: audioPlaying ? 'rgba(245,166,35,0.1)' : 'var(--bg-card)', color: audioPlaying ? 'var(--gold)' : 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Volume2 size={14} />
            {audioPlaying ? 'Playing in Hindi…' : 'AI Summary in Hindi'}
          </motion.button>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/app/dcf/${stock.ticker}`)}
            className="btn-primary btn-glow"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}>
            <BarChart3 size={14} /> Run DCF Model
          </motion.button>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/app/comps/${stock.ticker}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <GitCompare size={14} /> Comps Analysis
          </motion.button>
        </div>
      </motion.div>

      {/* Hindi audio toast */}
      {audioPlaying && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 14, padding: '14px 18px', fontSize: 13.5, color: 'var(--gold)', lineHeight: 1.6 }}>
          <Volume2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} /><strong>{stock.ticker} ka conviction score {stock.convictionScore} hai.</strong> Yeh {stock.sector} sector ki ek strong company hai. 12-month target ₹{stock.target12m} hai, jo current price se {stock.upside.toFixed(1)}% upar hai. Risk level: {stock.risk}.
        </motion.div>
      )}

      {/* Main grid — stacks on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 300px)', gap: 18 }}>

        {/* LEFT: Chart + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* ── Price chart card ─────────────────────────────── */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>

            {/* Timeframe row + price summary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {timeframes.map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', border: tf === timeframe ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: tf === timeframe ? 'var(--brand-dim)' : 'transparent', color: tf === timeframe ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit' }}>
                    {tf}
                  </button>
                ))}

                {/* Live feed indicator */}
                <motion.div
                  initial={false}
                  animate={{ opacity: 1 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: wsConnected ? 'rgba(45,181,98,0.08)' : 'rgba(229,57,53,0.06)', border: `1px solid ${wsConnected ? 'rgba(45,181,98,0.25)' : 'rgba(229,57,53,0.2)'}` }}
                >
                  {wsConnected
                    ? <Wifi size={11} color="var(--gain)" />
                    : <WifiOff size={11} color="var(--loss)" />}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: wsConnected ? 'var(--gain)' : 'var(--tx-3)', letterSpacing: '0.04em' }}>
                    {wsConnected ? 'LIVE' : 'DELAYED'}
                  </span>
                  {wsConnected && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gain)', animation: 'pulse 2s ease-in-out infinite', display: 'inline-block' }} />
                  )}
                </motion.div>
              </div>

              {/* Range badge */}
              {priceRange > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', gap: 12 }}>
                  <span>L: <span className="num" style={{ color: 'var(--tx-2)', fontWeight: 600 }}>₹{priceMin.toLocaleString('en-IN')}</span></span>
                  <span>H: <span className="num" style={{ color: 'var(--tx-2)', fontWeight: 600 }}>₹{priceMax.toLocaleString('en-IN')}</span></span>
                </div>
              )}
            </div>

            {/* ── TradingView Canvas Chart ─────────────────────────── */}
            {tvChartData.length > 0 ? (
              <TradingViewChart
                data={tvChartData}
                type="area"
                height={isMobile ? 240 : 320}
                showVolume={false}
                isPositive={positive}
                isDark
                onChartReady={(_chart, series) => {
                  tvSeriesRef.current = series as ISeriesApi<'Area'>;
                }}
              />
            ) : (
              <div style={{ height: isMobile ? 240 : 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                Loading chart…
              </div>
            )}
          </motion.div>

          {/* ── Technical Indicators ─────────────────────────── */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} color="var(--brand)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Technical Indicators</h3>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['RSI', 'MACD', 'Bollinger', 'Summary'] as const).map(tab => (
                  <button key={tab} onClick={() => setIndicatorTab(tab)}
                    style={{ padding: '4px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: indicatorTab === tab ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: indicatorTab === tab ? 'var(--brand-dim)' : 'transparent', color: indicatorTab === tab ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms', fontFamily: 'inherit' }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* RSI */}
            {indicatorTab === 'RSI' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600 }}>RSI (14)</span>
                    <span className="num" style={{ fontSize: 18, fontWeight: 800, color: indicators.curRSI !== null ? (indicators.curRSI as number) > 70 ? 'var(--loss)' : (indicators.curRSI as number) < 30 ? 'var(--gain)' : 'var(--brand)' : 'var(--tx-3)' }}>
                      {indicators.curRSI !== null ? (indicators.curRSI as number).toFixed(1) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[{ label: 'Overbought', val: '>70', color: 'var(--loss)' }, { label: 'Neutral', val: '30–70', color: 'var(--brand)' }, { label: 'Oversold', val: '<30', color: 'var(--gain)' }].map(z => (
                      <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: z.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{z.label} {z.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <LineChart data={indicators.rsiData} margin={{ top: 4, right: isMobile ? 4 : 50, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [(v as number).toFixed(1), 'RSI']} />
                      <ReferenceLine y={70} stroke="rgba(229,57,53,0.5)" strokeDasharray="4 3" label={{ value: '70', fill: 'var(--loss)', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={30} stroke="rgba(45,181,98,0.5)" strokeDasharray="4 3" label={{ value: '30', fill: 'var(--gain)', fontSize: 9, position: 'right' }} />
                      <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="2 4" />
                      <Line type="monotone" dataKey="rsi" stroke="var(--brand)" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10, lineHeight: 1.5 }}>
                  RSI measures momentum. Values above 70 suggest overbought conditions (potential sell), below 30 suggest oversold (potential buy opportunity).
                </p>
              </div>
            )}

            {/* MACD */}
            {indicatorTab === 'MACD' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: 'MACD', val: indicators.curMACD, color: 'var(--brand)' },
                    { label: 'Signal', val: indicators.curSignal, color: '#22d3ee' },
                  ].map(m => (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ width: 8, height: 3, background: m.color, display: 'inline-block', borderRadius: 2 }} />
                      <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600 }}>{m.label}</span>
                      <span className="num" style={{ fontSize: 16, fontWeight: 800, color: m.val !== null && (m.val as number) >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                        {m.val !== null ? (m.val as number).toFixed(2) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <ComposedChart data={indicators.macdData} margin={{ top: 4, right: isMobile ? 4 : 50, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, name?: unknown) => [(v as number).toFixed(2), name === 'hist' ? 'Histogram' : name === 'macd' ? 'MACD' : 'Signal']} />
                      <ReferenceLine y={0} stroke="var(--border-md)" />
                      <Bar dataKey="hist" name="hist" fill="var(--brand)" opacity={0.35} radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="macd" stroke="var(--brand)" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="signal" stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10, lineHeight: 1.5 }}>
                  MACD crossover above signal line is bullish. Histogram above zero confirms positive momentum.
                </p>
              </div>
            )}

            {/* Bollinger Bands */}
            {indicatorTab === 'Bollinger' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Upper Band', color: '#e53935' },
                    { label: 'Middle (SMA 20)', color: 'var(--brand)' },
                    { label: 'Lower Band', color: '#2db562' },
                    { label: 'Price', color: '#22d3ee' },
                  ].map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 16, height: 2, background: b.color, display: 'inline-block', borderRadius: 1 }} />
                      <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{b.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <ComposedChart data={indicators.bbData} margin={{ top: 4, right: isMobile ? 4 : 50, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis orientation="right" domain={['auto', 'auto']} tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={isMobile ? 44 : 64} tickFormatter={(v: number) => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, name?: unknown) => { const n = String(name ?? ''); return [`₹${(v as number).toLocaleString('en-IN')}`, ({ price: 'Price', upper: 'Upper Band', middle: 'SMA 20', lower: 'Lower Band' } as Record<string, string>)[n] ?? n]; }} />
                      <Area type="monotone" dataKey="upper" stroke="#e5393540" strokeWidth={1} fill="rgba(229,57,53,0.05)" dot={false} connectNulls />
                      <Area type="monotone" dataKey="lower" stroke="#2db56240" strokeWidth={1} fill="rgba(45,181,98,0.05)" dot={false} connectNulls />
                      <Line type="monotone" dataKey="upper" stroke="#e53935" strokeWidth={1} dot={false} connectNulls strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="lower" stroke="#2db562" strokeWidth={1} dot={false} connectNulls strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="middle" stroke="var(--brand)" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="price" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 10, lineHeight: 1.5 }}>
                  Bollinger Bands (20, 2σ). Price touching upper band may indicate overbought; lower band may indicate oversold. Band squeeze signals low volatility before a breakout.
                </p>
              </div>
            )}

            {/* Summary */}
            {indicatorTab === 'Summary' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'RSI (14)', value: indicators.curRSI !== null ? (indicators.curRSI as number).toFixed(1) : '—', signal: indicators.curRSI !== null ? (indicators.curRSI as number) > 70 ? 'Overbought' : (indicators.curRSI as number) < 30 ? 'Oversold' : 'Neutral' : '—', color: indicators.curRSI !== null ? (indicators.curRSI as number) > 70 ? 'var(--loss)' : (indicators.curRSI as number) < 30 ? 'var(--gain)' : 'var(--tx-2)' : 'var(--tx-3)' },
                    { label: 'MACD', value: indicators.curMACD !== null ? (indicators.curMACD as number).toFixed(2) : '—', signal: indicators.curMACD !== null && indicators.curSignal !== null ? (indicators.curMACD as number) > (indicators.curSignal as number) ? 'Bullish' : 'Bearish' : '—', color: indicators.curMACD !== null && indicators.curSignal !== null ? (indicators.curMACD as number) > (indicators.curSignal as number) ? 'var(--gain)' : 'var(--loss)' : 'var(--tx-3)' },
                    { label: 'EMA 20', value: indicators.curEMA20 !== null ? `₹${(indicators.curEMA20 as number).toFixed(0)}` : '—', signal: indicators.curEMA20 !== null ? stock.price > (indicators.curEMA20 as number) ? 'Above' : 'Below' : '—', color: indicators.curEMA20 !== null ? stock.price > (indicators.curEMA20 as number) ? 'var(--gain)' : 'var(--loss)' : 'var(--tx-3)' },
                    { label: 'EMA 50', value: indicators.curEMA50 !== null ? `₹${(indicators.curEMA50 as number).toFixed(0)}` : '—', signal: indicators.curEMA50 !== null ? stock.price > (indicators.curEMA50 as number) ? 'Above' : 'Below' : '—', color: indicators.curEMA50 !== null ? stock.price > (indicators.curEMA50 as number) ? 'var(--gain)' : 'var(--loss)' : 'var(--tx-3)' },
                    { label: 'Stoch %K', value: indicators.curK !== null ? (indicators.curK as number).toFixed(1) : '—', signal: indicators.curK !== null ? (indicators.curK as number) > 80 ? 'Overbought' : (indicators.curK as number) < 20 ? 'Oversold' : 'Neutral' : '—', color: indicators.curK !== null ? (indicators.curK as number) > 80 ? 'var(--loss)' : (indicators.curK as number) < 20 ? 'var(--gain)' : 'var(--tx-2)' : 'var(--tx-3)' },
                    { label: 'Stoch %D', value: indicators.curD !== null ? (indicators.curD as number).toFixed(1) : '—', signal: '3-day SMA of %K', color: 'var(--tx-2)' },
                    { label: 'ATR (14)', value: `₹${indicators.atr.toFixed(0)}`, signal: indicators.atr > stock.price * 0.03 ? 'High Volatility' : indicators.atr < stock.price * 0.01 ? 'Low Volatility' : 'Normal', color: indicators.atr > stock.price * 0.03 ? 'var(--loss)' : indicators.atr < stock.price * 0.01 ? 'var(--gain)' : 'var(--tx-2)' },
                    { label: 'OBV', value: indicators.curOBV > 0 ? `+${(indicators.curOBV / 1e6).toFixed(1)}M` : `${(indicators.curOBV / 1e6).toFixed(1)}M`, signal: indicators.curOBV > 0 ? 'Accumulation' : 'Distribution', color: indicators.curOBV > 0 ? 'var(--gain)' : 'var(--loss)' },
                    { label: 'Williams %R', value: indicators.curWR !== null ? (indicators.curWR as number).toFixed(1) : '—', signal: indicators.curWR !== null ? (indicators.curWR as number) > -20 ? 'Overbought' : (indicators.curWR as number) < -80 ? 'Oversold' : 'Neutral' : '—', color: indicators.curWR !== null ? (indicators.curWR as number) > -20 ? 'var(--loss)' : (indicators.curWR as number) < -80 ? 'var(--gain)' : 'var(--tx-2)' : 'var(--tx-3)' },
                    { label: 'CCI (20)', value: indicators.curCCI !== null ? (indicators.curCCI as number).toFixed(0) : '—', signal: indicators.curCCI !== null ? (indicators.curCCI as number) > 100 ? 'Overbought' : (indicators.curCCI as number) < -100 ? 'Oversold' : 'Neutral' : '—', color: indicators.curCCI !== null ? (indicators.curCCI as number) > 100 ? 'var(--loss)' : (indicators.curCCI as number) < -100 ? 'var(--gain)' : 'var(--tx-2)' : 'var(--tx-3)' },
                  ].map(ind => (
                    <motion.div key={ind.label} whileHover={{ background: 'var(--bg-hover)' }}
                      style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', transition: 'background 150ms' }}>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>{ind.label}</div>
                      <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>{ind.value}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: ind.color, padding: '2px 7px', background: `${ind.color === 'var(--gain)' ? 'rgba(45,181,98,0.1)' : ind.color === 'var(--loss)' ? 'rgba(229,57,53,0.1)' : 'var(--surface-mid)'}`, borderRadius: 6, display: 'inline-block' }}>
                        {ind.signal}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 14, lineHeight: 1.5, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  <AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Technical indicators are based on historical price data. Use in conjunction with fundamental analysis. Not investment advice.
                </p>
              </div>
            )}
          </motion.div>

          {/* Key statistics */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Activity size={14} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Key Statistics</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 10 }}>
              {[
                { label: 'Market Cap',       value: `₹${stock.marketCap.toLocaleString('en-IN')} Cr` },
                { label: 'P/E Ratio',        value: stock.pe.toFixed(1) + 'x' },
                { label: 'EV/EBITDA',        value: stock.evEbitda.toFixed(1) + 'x' },
                { label: 'ROCE',             value: `${stock.roce}%` },
                { label: 'Debt/Equity',      value: stock.debtEquity.toFixed(2) },
                { label: 'Promoter Holding', value: `${stock.promoterHolding}%` },
                { label: '52W High',         value: `₹${stock.high52w}` },
                { label: '52W Low',          value: `₹${stock.low52w}` },
                { label: 'Rev Growth (YoY)', value: `+${stock.revenueGrowth}%` },
              ].map(s => (
                <motion.div key={s.label} whileHover={{ background: 'var(--bg-hover)' }}
                  style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', transition: 'background 150ms' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, fontWeight: 600 }}>{s.label}</div>
                  <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{s.value}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Analyst targets */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Target size={14} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Analyst Targets</h3>
              <SystemStatus live={analystsLive} subject="Analyst targets" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analystData.map((a, i) => {
                const rs = ratingStyle(a.rating);
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{a.firm}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{a.analyst} · {a.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>₹{a.target}</div>
                      <div className="num" style={{ fontSize: 12, color: 'var(--gain)', fontWeight: 600 }}>+{a.upside}%</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: rs.bg, color: rs.color, flexShrink: 0 }}>{a.rating}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quarterly Financials */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={14} color="var(--brand)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Quarterly Financials</h3>
                <SystemStatus live={finLive} subject="Quarterly financials" />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { key: 'rev',    label: 'Revenue' },
                  { key: 'ebitda', label: 'EBITDA' },
                  { key: 'pat',    label: 'PAT' },
                  { key: 'eps',    label: 'EPS' },
                ].map(m => (
                  <button key={m.key} onClick={() => setQMetric(m.key as 'rev' | 'ebitda' | 'pat' | 'eps')}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: qMetric === m.key ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: qMetric === m.key ? 'var(--brand-dim)' : 'transparent', color: qMetric === m.key ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit', transition: 'all 150ms' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <BarChart data={qDataLive} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="q" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={44}
                    tickFormatter={(v: number) => qMetric === 'eps' ? `₹${v}` : v >= 100000 ? `${(v/100000).toFixed(0)}L` : `${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: unknown) => [qMetric === 'eps' ? `₹${v}` : `₹${Number(v).toLocaleString('en-IN')} Cr`, { rev: 'Revenue', ebitda: 'EBITDA', pat: 'PAT', eps: 'EPS' }[qMetric]]}
                  />
                  <Bar dataKey={qMetric} fill="var(--brand)" radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* QoQ change row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 12 }}>
              {qDataLive.map((q, i) => {
                const prev = i > 0 ? qDataLive[i - 1][qMetric] : null;
                const curr = q[qMetric];
                const chg  = prev ? ((curr - prev) / prev * 100).toFixed(1) : null;
                return (
                  <div key={q.q} style={{ textAlign: 'center', padding: '6px 4px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 2 }}>{q.q}</div>
                    <div className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx)' }}>
                      {qMetric === 'eps' ? `₹${curr}` : `${(curr / 1000).toFixed(0)}K`}
                    </div>
                    {chg && (
                      <div className="num" style={{ fontSize: 10, color: parseFloat(chg) >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 600, marginTop: 1 }}>
                        {parseFloat(chg) >= 0 ? '+' : ''}{chg}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* RIGHT sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* AI Conviction Breakdown */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertCircle size={14} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>AI Conviction Breakdown</h3>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <PieChart width={150} height={150}>
                <Pie data={convictionBreakdown} dataKey="value" cx={75} cy={75} innerRadius={42} outerRadius={65} strokeWidth={0}>
                  {convictionBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </div>
            {/* Score in center via absolute overlay */}
            <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 28, fontWeight: 900, color: 'var(--brand)', marginTop: -24 }}>
              {stock.convictionScore}
              <span style={{ fontSize: 13, color: 'var(--tx-3)', fontWeight: 600, marginLeft: 4 }}>/10</span>
            </div>
            {convictionBreakdown.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--tx-2)' }}>{c.name}</span>
                </div>
                <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>{c.value}%</span>
              </div>
            ))}
          </motion.div>

          {/* Conviction 2.0 — factor waterfall */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <ConvictionFactors
              explain={explainQuery.data ?? null}
              fallbackRows={buildFactorWaterfall(detailQuery.data?.conviction?.factors ?? demoConvictionFactors(stock.convictionScore))}
              score={stock.convictionScore}
            />
          </motion.div>

          {/* Investment Thesis */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 12 }}>Investment Thesis</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.65, marginBottom: 16 }}>
              {detailQuery.data?.conviction?.rationale ?? stock.description}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              {[
                { label: '12M Target', value: `₹${stock.target12m}`, color: 'var(--gain)' },
                { label: 'Upside',     value: `+${stock.upside}%`,   color: 'var(--gain)' },
                { label: 'Risk Level', value: stock.risk,             color: stock.risk === 'High' ? 'var(--loss)' : stock.risk === 'Medium' ? 'var(--gold)' : 'var(--gain)' },
                { label: 'Rating',     value: stock.analystRating,    color: stock.analystRating === 'Buy' ? 'var(--gain)' : stock.analystRating === 'Sell' ? 'var(--loss)' : 'var(--gold)' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{r.label}</span>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Related News */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Related News</h3>
              <SystemStatus live={newsLive} subject="Related news" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {newsData.map((n, i) => (
                <div key={n.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < newsData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55, marginBottom: 6 }}>{n.headline}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{n.time}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                      background: n.sentiment === 'Positive' ? 'rgba(45,181,98,0.1)' : n.sentiment === 'Negative' ? 'rgba(229,57,53,0.1)' : 'var(--surface-mid)',
                      color: n.sentiment === 'Positive' ? 'var(--gain)' : n.sentiment === 'Negative' ? 'var(--loss)' : 'var(--tx-3)' }}>
                      {n.sentiment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
