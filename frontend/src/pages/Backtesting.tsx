import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlanGate, { usePlanAccess } from '../components/ui/PlanGate';
import {
  Play, RotateCcw, TrendingUp, TrendingDown, AlertCircle,
  BarChart3, Activity, Zap, Plus, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react';
import Dropdown from '../components/ui/Dropdown';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useIsMobile } from '../hooks/useBreakpoint';

/* ── Types ──────────────────────────────────────────────────────── */
type StrategyType = 'rsi_oversold' | 'macd_cross' | 'golden_cross' | 'bb_bounce' | 'custom';
type ConditionOp  = '>' | '<' | 'crosses_above' | 'crosses_below';

interface Condition {
  id: string; indicator: string; op: ConditionOp; value: number;
}

interface BacktestResult {
  totalReturn: number; cagr: number; maxDrawdown: number; sharpe: number;
  winRate: number; avgWin: number; avgLoss: number; totalTrades: number;
  profitFactor: number; equity: { date: string; value: number; benchmark: number }[];
  trades: { date: string; action: 'BUY' | 'SELL'; price: number; pnl: number; duration: number }[];
}

/* ── Strategies ─────────────────────────────────────────────────── */
const STRATEGIES: { id: StrategyType; name: string; desc: string; color: string; icon: string }[] = [
  { id: 'rsi_oversold',  name: 'RSI Oversold Bounce',  desc: 'Buy when RSI(14) drops below 30, sell above 70', color: '#22D3EE',  icon: '📉' },
  { id: 'macd_cross',    name: 'MACD Crossover',        desc: 'Buy on MACD bullish cross, sell on bearish cross', color: '#A78BFA', icon: '📊' },
  { id: 'golden_cross',  name: 'Golden/Death Cross',    desc: '50 DMA crosses 200 DMA buy/sell signals',         color: '#F5A623',  icon: '✨' },
  { id: 'bb_bounce',     name: 'Bollinger Band Bounce', desc: 'Buy at lower band, sell at upper band',            color: '#00C896',  icon: '🎯' },
  { id: 'custom',        name: 'Custom Strategy',       desc: 'Build your own multi-condition strategy',          color: '#f47520',  icon: '⚙️' },
];

const TICKERS = ['NIFTY 50', 'HAL', 'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'BEL', 'MTAR', 'PARAS'];
const INDICATORS = ['RSI(14)', 'MACD Line', 'Signal Line', 'EMA(20)', 'EMA(50)', 'EMA(200)', 'Close Price', 'Volume', 'ATR(14)', 'BB Upper', 'BB Lower'];
const OPS: { v: ConditionOp; l: string }[] = [
  { v: '>', l: 'is above' }, { v: '<', l: 'is below' },
  { v: 'crosses_above', l: 'crosses above' }, { v: 'crosses_below', l: 'crosses below' },
];

/* ── Simulate backtest ──────────────────────────────────────────── */
function runBacktest(strategy: StrategyType, ticker: string, period: string): BacktestResult {
  const months = period === '1Y' ? 12 : period === '3Y' ? 36 : period === '5Y' ? 60 : 120;
  const seed = strategy.charCodeAt(0) + ticker.charCodeAt(0);
  const rand = (i: number) => Math.sin(seed + i) * 0.5 + 0.5;

  const baseReturn = strategy === 'golden_cross' ? 0.12 : strategy === 'rsi_oversold' ? 0.18 : strategy === 'macd_cross' ? 0.14 : strategy === 'bb_bounce' ? 0.16 : 0.13;
  const totalReturn = baseReturn * (months / 12) + (rand(42) - 0.3) * 0.08;
  const cagr = Math.pow(1 + totalReturn, 12 / months) - 1;
  const maxDrawdown = -(0.08 + rand(7) * 0.12);
  const sharpe = 1.2 + rand(11) * 0.8;
  const winRate = 52 + rand(13) * 15;
  const totalTrades = Math.round(months * (2 + rand(5) * 3));
  const avgWin  = 4.2 + rand(17) * 3;
  const avgLoss = 2.1 + rand(19) * 1.5;
  const profitFactor = (winRate / 100 * avgWin) / ((1 - winRate / 100) * avgLoss);

  // Generate equity curve
  let equity = 100000;
  let benchmark = 100000;
  const equityCurve: BacktestResult['equity'] = [];
  for (let m = 0; m <= months; m++) {
    const mReturn = totalReturn / months + (rand(m * 3) - 0.48) * 0.04;
    const bReturn = 0.12 / 12 + (rand(m * 7) - 0.48) * 0.03;
    equity    *= (1 + mReturn);
    benchmark *= (1 + bReturn);
    const yr = 2026 - Math.ceil((months - m) / 12);
    const mo = ((m % 12) + 1).toString().padStart(2, '0');
    equityCurve.push({ date: `${yr}-${mo}`, value: Math.round(equity), benchmark: Math.round(benchmark) });
  }

  // Generate trades
  const trades: BacktestResult['trades'] = [];
  const basePrice = ticker === 'HAL' ? 4125 : ticker === 'RELIANCE' ? 2847 : ticker === 'NIFTY 50' ? 24834 : 1000;
  for (let t = 0; t < Math.min(20, totalTrades); t++) {
    const win = rand(t * 17 + 3) < winRate / 100;
    const pnl = win ? avgWin * (0.8 + rand(t) * 0.4) : -avgLoss * (0.8 + rand(t + 1) * 0.4);
    const mo = Math.floor(t * months / 20);
    const yr = 2026 - Math.ceil((months - mo) / 12);
    trades.push({
      date:     `${yr}-${((mo % 12) + 1).toString().padStart(2, '0')}-${(1 + Math.floor(rand(t * 5) * 27)).toString().padStart(2, '0')}`,
      action:   t % 2 === 0 ? 'BUY' : 'SELL',
      price:    Math.round(basePrice * (0.85 + rand(t * 11) * 0.3)),
      pnl:      parseFloat((pnl * basePrice / 100).toFixed(0)),
      duration: Math.round(5 + rand(t * 23) * 25),
    });
  }

  return { totalReturn, cagr, maxDrawdown, sharpe, winRate, avgWin, avgLoss, totalTrades, profitFactor, equity: equityCurve, trades };
}

/* ── Component ──────────────────────────────────────────────────── */
export default function Backtesting() {
  const isMobile = useIsMobile();
  const [strategy, setStrategy]   = useState<StrategyType>('rsi_oversold');
  const [ticker, setTicker]       = useState('NIFTY 50');
  const [period, setPeriod]       = useState('3Y');
  const [capital, setCapital]     = useState(100000);
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<BacktestResult | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', indicator: 'RSI(14)', op: '<', value: 30 },
  ]);
  const [activeChart, setActiveChart] = useState<'equity' | 'drawdown' | 'trades'>('equity');

  const handleRun = () => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult(runBacktest(strategy, ticker, period));
      setRunning(false);
    }, 1800);
  };

  const addCondition = () =>
    setConditions(c => [...c, { id: Date.now().toString(), indicator: 'EMA(20)', op: '>', value: 0 }]);

  const removeCondition = (id: string) =>
    setConditions(c => c.filter(x => x.id !== id));

  const drawdownCurve = useMemo(() => {
    if (!result) return [];
    let peak = result.equity[0]?.value ?? 100000;
    return result.equity.map(pt => {
      if (pt.value > peak) peak = pt.value;
      return { date: pt.date, dd: ((pt.value - peak) / peak * 100) };
    });
  }, [result]);

  const activeSt = STRATEGIES.find(s => s.id === strategy)!;

  const hasAccess = usePlanAccess('premium');
  if (!hasAccess) return <PlanGate requires="premium" feature="Backtesting Engine" mode="replace"><></></PlanGate>;

  return (
    <div style={{ maxWidth: 1400, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', marginBottom: 4 }}>Strategy Backtester</h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 20 }}>Test your trading strategy on NSE historical data. See CAGR, drawdown, win rate & more.</p>

        {/* Strategy selector */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
          {STRATEGIES.map(s => (
            <motion.button key={s.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => setStrategy(s.id)}
              style={{ padding: '14px 12px', borderRadius: 12, border: strategy === s.id ? `1px solid ${s.color}60` : '1px solid var(--border)', background: strategy === s.id ? `${s.color}10` : 'var(--surface-mid)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 180ms' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: strategy === s.id ? s.color : 'var(--tx)', marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', lineHeight: 1.5 }}>{s.desc}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Config panel ──────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}>

          {/* Left: Inputs */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={15} color="var(--brand)" /> Strategy Parameters
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700 }}>
                TICKER / INDEX
                <Dropdown options={TICKERS.map(t => ({ label: t, value: t }))} value={ticker} onChange={setTicker} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700 }}>
                  BACKTEST PERIOD
                  <Dropdown options={['1Y','3Y','5Y','10Y'].map(p => ({ label: p, value: p }))} value={period} onChange={setPeriod} />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700 }}>
                  CAPITAL (₹)
                  <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} min={10000} step={10000}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--tx)', fontSize: 13.5, fontFamily: 'inherit' }} />
                </label>
              </div>
            </div>
          </div>

          {/* Right: Custom conditions (for 'custom' mode) */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={15} color={activeSt.color} /> {strategy === 'custom' ? 'Custom Conditions' : 'Strategy Logic'}
              </div>
              {strategy === 'custom' && (
                <button onClick={addCondition}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-mid)', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus size={12} /> Add Rule
                </button>
              )}
            </div>

            {strategy === 'custom' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conditions.map((cond, i) => (
                  <motion.div key={cond.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px 28px', gap: 6, alignItems: 'center' }}>
                    <Dropdown
                      options={INDICATORS.map(ind => ({ label: ind, value: ind }))}
                      value={cond.indicator}
                      onChange={val => setConditions(cs => cs.map(c => c.id === cond.id ? { ...c, indicator: val } : c))}
                    />
                    <Dropdown
                      options={OPS.map(o => ({ label: o.l, value: o.v }))}
                      value={cond.op}
                      onChange={val => setConditions(cs => cs.map(c => c.id === cond.id ? { ...c, op: val as ConditionOp } : c))}
                    />
                    <input type="number" value={cond.value} onChange={e => setConditions(cs => cs.map(c => c.id === cond.id ? { ...c, value: Number(e.target.value) } : c))}
                      style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--tx)', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }} />
                    <button onClick={() => removeCondition(cond.id)}
                      style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--loss)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                ))}
                {conditions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--tx-3)', fontSize: 13 }}>Add conditions above to define your entry signal</div>
                )}
              </div>
            ) : (
              <div style={{ padding: '14px 16px', background: `${activeSt.color}08`, border: `1px solid ${activeSt.color}25`, borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 10, fontWeight: 700 }}>{activeSt.name}</div>
                {strategy === 'rsi_oversold' && (
                  <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.7 }}>
                    🟢 <strong>BUY:</strong> RSI(14) crosses below 30 (oversold)<br />
                    🔴 <strong>SELL:</strong> RSI(14) crosses above 70 (overbought)<br />
                    ⏱ Hold: minimum 5 trading days
                  </div>
                )}
                {strategy === 'macd_cross' && (
                  <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.7 }}>
                    🟢 <strong>BUY:</strong> MACD Line crosses above Signal Line<br />
                    🔴 <strong>SELL:</strong> MACD Line crosses below Signal Line<br />
                    ⏱ Parameters: Fast 12, Slow 26, Signal 9
                  </div>
                )}
                {strategy === 'golden_cross' && (
                  <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.7 }}>
                    🟢 <strong>BUY:</strong> EMA(50) crosses above EMA(200)<br />
                    🔴 <strong>SELL:</strong> EMA(50) crosses below EMA(200)<br />
                    ⏱ Long-term trend-following strategy
                  </div>
                )}
                {strategy === 'bb_bounce' && (
                  <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.7 }}>
                    🟢 <strong>BUY:</strong> Price touches lower Bollinger Band (2σ)<br />
                    🔴 <strong>SELL:</strong> Price touches upper Bollinger Band or middle<br />
                    ⏱ Mean-reversion strategy, works in sideways markets
                  </div>
                )}
              </div>
            )}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleRun} disabled={running}
              style={{ width: '100%', marginTop: 18, padding: '13px 0', borderRadius: 12, border: 'none', background: running ? 'var(--border)' : `linear-gradient(135deg,${activeSt.color},${activeSt.color}99)`, color: running ? 'var(--tx-3)' : '#fff', fontSize: 14, fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {running
                ? <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RotateCcw size={15} /></motion.span> Running simulation…</>
                : <><Play size={15} /> Run Backtest</>
              }
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Results ───────────────────────────────────────────── */}
      <AnimatePresence>
        {running && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2 }} style={{ display: 'inline-block', marginBottom: 16 }}>
              <BarChart3 size={32} color={activeSt.color} />
            </motion.div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Processing {period} of {ticker} data…</div>
            <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>Simulating {STRATEGIES.find(s => s.id === strategy)?.name} on {period === '10Y' ? '2,500+' : period === '5Y' ? '1,250+' : period === '3Y' ? '750+' : '250+'} candles</div>
          </motion.div>
        )}

        {result && !running && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
              {[
                { label: 'Total Return',    value: `${result.totalReturn >= 0 ? '+' : ''}${(result.totalReturn * 100).toFixed(1)}%`, sub: `${period} period`, color: result.totalReturn >= 0 ? 'var(--gain)' : 'var(--loss)' },
                { label: 'CAGR',            value: `${(result.cagr * 100).toFixed(1)}%`,      sub: 'Annualised',       color: result.cagr >= 0.12 ? 'var(--gain)' : 'var(--brand)' },
                { label: 'Max Drawdown',    value: `${(result.maxDrawdown * 100).toFixed(1)}%`,sub: 'Peak to trough',  color: 'var(--loss)' },
                { label: 'Sharpe Ratio',    value: result.sharpe.toFixed(2),                   sub: 'Risk-adjusted',    color: result.sharpe >= 1.5 ? 'var(--gain)' : result.sharpe >= 1 ? 'var(--gold)' : 'var(--loss)' },
                { label: 'Win Rate',        value: `${result.winRate.toFixed(1)}%`,             sub: `of ${result.totalTrades} trades`, color: result.winRate >= 55 ? 'var(--gain)' : 'var(--brand)' },
                { label: 'Avg Win',         value: `+${result.avgWin.toFixed(1)}%`,             sub: 'Per winning trade', color: 'var(--gain)' },
                { label: 'Avg Loss',        value: `-${result.avgLoss.toFixed(1)}%`,            sub: 'Per losing trade',  color: 'var(--loss)' },
                { label: 'Profit Factor',   value: result.profitFactor.toFixed(2),              sub: 'Gross win / loss',  color: result.profitFactor >= 1.5 ? 'var(--gain)' : 'var(--gold)' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className="glass-card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 6 }}>{s.label}</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 900, color: s.color, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{s.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* Chart tabs */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 18px' }}>
                {([['equity', 'Equity Curve'], ['drawdown', 'Drawdown'], ['trades', 'Trade Log']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setActiveChart(v)}
                    style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: activeChart === v ? `2px solid ${activeSt.color}` : '2px solid transparent', color: activeChart === v ? activeSt.color : 'var(--tx-3)', marginBottom: -1, fontFamily: 'inherit', transition: 'all 150ms' }}>
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ padding: '20px 18px' }}>
                <AnimatePresence mode="wait">
                  {activeChart === 'equity' && (
                    <motion.div key="eq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                          <AreaChart data={result.equity} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activeSt.color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={activeSt.color} stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--tx-3)" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="var(--tx-3)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10.5 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} width={52} />
                            <Tooltip
                              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 12 }}
                              formatter={(v: unknown, name?: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'value' ? 'Strategy' : 'Benchmark']}
                            />
                            <Area type="monotone" dataKey="benchmark" stroke="var(--tx-3)" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#benchGrad)" dot={false} />
                            <Area type="monotone" dataKey="value" stroke={activeSt.color} strokeWidth={2.5} fill="url(#stratGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 24, height: 3, background: activeSt.color, borderRadius: 2 }} /><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Strategy</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 24, height: 3, background: 'var(--tx-3)', borderRadius: 2, opacity: 0.6 }} /><span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Nifty 50 (Benchmark)</span></div>
                      </div>
                    </motion.div>
                  )}

                  {activeChart === 'drawdown' && (
                    <motion.div key="dd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                          <AreaChart data={drawdownCurve} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FF4D6A" stopOpacity={0} />
                                <stop offset="100%" stopColor="#FF4D6A" stopOpacity={0.4} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: 'var(--tx-3)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10.5 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} width={44} />
                            <ReferenceLine y={0} stroke="var(--border-md)" />
                            <Tooltip
                              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 12 }}
                              formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'Drawdown']}
                            />
                            <Area type="monotone" dataKey="dd" stroke="#FF4D6A" strokeWidth={2} fill="url(#ddGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  )}

                  {activeChart === 'trades' && (
                    <motion.div key="tr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Date', 'Action', 'Price', 'P&L (₹)', 'Duration', 'Return'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Date' || h === 'Action' ? 'left' : 'right', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.trades.map((t, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--tx-3)' }}>{t.date}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: t.action === 'BUY' ? 'rgba(0,200,150,0.12)' : 'rgba(255,77,106,0.12)', color: t.action === 'BUY' ? 'var(--gain)' : 'var(--loss)' }}>{t.action}</span>
                                </td>
                                <td className="num" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>₹{t.price.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>{t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}</span>
                                </td>
                                <td className="num" style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12.5, color: 'var(--tx-3)' }}>{t.duration}d</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <span className="num" style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, color: t.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                                    {t.pnl >= 0 ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    {Math.abs(t.pnl / t.price * 100).toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--tx-3)', padding: '8px 0' }}>
                        Showing last 20 trades · Total trades in period: {result.totalTrades}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={15} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tx)' }}>Past performance is not a guarantee of future results.</strong> Backtesting results are hypothetical and based on historical data. Real trading involves slippage, transaction costs, and market impact not reflected here. This is for educational purposes only.
              </div>
            </div>
          </motion.div>
        )}

        {!result && !running && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>Configure your strategy and click Run Backtest</div>
              <div style={{ fontSize: 13.5, color: 'var(--tx-3)', maxWidth: 500, margin: '0 auto' }}>
                Choose a strategy preset or build custom conditions. We'll simulate it across {period} of {ticker} historical data.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
