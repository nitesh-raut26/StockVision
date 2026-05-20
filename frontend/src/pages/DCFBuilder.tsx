import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PlanGate, { usePlanAccess } from '../components/ui/PlanGate';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, Info, TrendingUp, ChevronLeft, BarChart2, Table2 } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { mockStocks } from '../data/mockData';
import { fetchDcf } from '../lib/api';

const cardVariant = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } },
};

const fmt = (n: number) => n >= 100000
  ? `₹${(n / 100000).toFixed(1)}L Cr`
  : `₹${n.toLocaleString('en-IN')} Cr`;

const fmtShort = (n: number) => n >= 100000
  ? `${(n / 100000).toFixed(0)}L`
  : n >= 1000
    ? `${(n / 1000).toFixed(0)}K`
    : String(n);

type OutputView = 'chart' | 'table';

export default function DCFBuilder() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();
  const stock = mockStocks.find(s => s.ticker === ticker) ?? mockStocks.find(s => s.ticker === 'RELIANCE')!;

  const [wacc,           setWacc]           = useState(11);
  const [revCagr,        setRevCagr]        = useState(12);
  const [ebitdaMargin,   setEbitdaMargin]   = useState(18);
  const [capexPct,       setCapexPct]       = useState(8);
  const [terminalGrowth, setTerminalGrowth] = useState(5);
  const [netDebt]   = useState(stock.revenue ? Math.round(stock.revenue * 0.4) : 8000);
  const [shares]    = useState(420);
  const [outputView, setOutputView] = useState<OutputView>('table');

  const liveDcfQuery = useQuery({
    queryKey: ['dcf', ticker, wacc, revCagr],
    queryFn:  () => fetchDcf(stock.ticker, wacc / 100, 7),
  });

  // ── Annual FCF projection (7 years) ─────────────────────────
  const projections = useMemo(() => {
    const baseRevenue = stock.revenue || 500;
    let rev = baseRevenue;
    const currentYear = new Date().getFullYear();
    const rows: {
      year: string; revenue: number; ebitda: number; ebitdaMarginPct: number;
      depreciation: number; ebit: number; nopat: number; capex: number;
      nwcChange: number; fcf: number; discFactor: number; pvFcf: number;
    }[] = [];

    let pvFcfSum = 0;

    for (let y = 1; y <= 7; y++) {
      rev = rev * (1 + revCagr / 100);
      const ebitda       = rev * (ebitdaMargin / 100);
      const depreciation = rev * 0.04;              // ~4% of revenue
      const ebit         = ebitda - depreciation;
      const nopat        = ebit * 0.75;             // 25% effective tax
      const capex        = rev * (capexPct / 100);
      const nwcChange    = rev * 0.015;             // 1.5% incremental NWC
      const fcf          = nopat + depreciation - capex - nwcChange;
      const discFactor   = Math.pow(1 + wacc / 100, y);
      const pvFcf        = fcf / discFactor;
      pvFcfSum += pvFcf;

      rows.push({
        year: `FY${currentYear + y}`,
        revenue: Math.round(rev),
        ebitda:  Math.round(ebitda),
        ebitdaMarginPct: ebitdaMargin,
        depreciation:   Math.round(depreciation),
        ebit:    Math.round(ebit),
        nopat:   Math.round(nopat),
        capex:   Math.round(capex),
        nwcChange: Math.round(nwcChange),
        fcf:     Math.round(fcf),
        discFactor: parseFloat(discFactor.toFixed(3)),
        pvFcf:   Math.round(pvFcf),
      });
    }

    const lastFcf      = rows[rows.length - 1].fcf;
    const tvFcf        = lastFcf * (1 + terminalGrowth / 100) / ((wacc - terminalGrowth) / 100);
    const pvTv         = Math.round(tvFcf / Math.pow(1 + wacc / 100, 7));
    const ev           = Math.round(pvFcfSum) + pvTv;
    const equityValue  = ev - netDebt;
    const impliedPrice = Math.round((equityValue / shares) * 10);
    const upside       = ((impliedPrice - stock.price) / stock.price * 100).toFixed(1);

    return { rows, pvFcfSum: Math.round(pvFcfSum), terminalValue: Math.round(tvFcf), pvTerminalValue: pvTv, enterpriseValue: ev, equityValue, impliedPrice, upside };
  }, [wacc, revCagr, ebitdaMargin, capexPct, terminalGrowth, netDebt, shares, stock]);

  // ── Scenario grid ────────────────────────────────────────────
  const dcf = useMemo(() => {
    const baseRevenue = stock.revenue || 500;
    const scenarios = {
      Bear: { cagr: revCagr * 0.6,  margin: ebitdaMargin * 0.8,  waccAdj: wacc + 1.5 },
      Base: { cagr: revCagr,         margin: ebitdaMargin,         waccAdj: wacc },
      Bull: { cagr: revCagr * 1.4,  margin: ebitdaMargin * 1.15, waccAdj: wacc - 1 },
    };
    const calcPrice = (s: typeof scenarios.Bear) => {
      let pv = 0, rev = baseRevenue;
      for (let y = 1; y <= 7; y++) {
        rev *= (1 + s.cagr / 100);
        const fcf = rev * (s.margin / 100) * (1 - capexPct / 100);
        pv += fcf / Math.pow(1 + s.waccAdj / 100, y);
      }
      const tv   = rev * (s.margin / 100) * (1 - capexPct / 100) * (1 + terminalGrowth / 100) / ((s.waccAdj - terminalGrowth) / 100);
      const pvTv = tv / Math.pow(1 + s.waccAdj / 100, 7);
      return parseFloat(((pv + pvTv) / shares * 10).toFixed(0));
    };
    return { Bear: calcPrice(scenarios.Bear), Base: calcPrice(scenarios.Base), Bull: calcPrice(scenarios.Bull) };
  }, [wacc, revCagr, ebitdaMargin, capexPct, terminalGrowth, shares, stock]);

  // ── Sensitivity matrix ───────────────────────────────────────
  const waccRange = [wacc - 2, wacc - 1, wacc, wacc + 1, wacc + 2];
  const tgRange   = [terminalGrowth - 1, terminalGrowth, terminalGrowth + 1, terminalGrowth + 2, terminalGrowth + 3];

  const getCellStyle = (implied: number) => {
    const pct = (implied - stock.price) / stock.price * 100;
    if (pct >= 30)  return { background: 'rgba(45,181,98,0.18)',  color: '#15803d', fontWeight: 700 };
    if (pct >= 10)  return { background: 'rgba(45,181,98,0.09)',  color: '#15803d', fontWeight: 600 };
    if (pct >= -10) return { background: 'var(--bg-elevated)',    color: 'var(--tx-2)', fontWeight: 600 };
    if (pct >= -30) return { background: 'rgba(244,117,32,0.1)',  color: 'var(--brand)', fontWeight: 600 };
    return               { background: 'rgba(229,57,53,0.12)',   color: '#b91c1c', fontWeight: 700 };
  };

  const impliedAt = (w: number, tg: number) => {
    const rev7 = (stock.revenue || 500) * Math.pow(1 + revCagr / 100, 7);
    const fcf7 = rev7 * (ebitdaMargin / 100) * (1 - capexPct / 100);
    const tv   = fcf7 * (1 + tg / 100) / ((w - tg) / 100);
    return Math.max(0, Math.round((tv * 0.5) / shares * 10));
  };

  const scenarioConfig = {
    Bear: { color: 'var(--loss)',  border: 'rgba(229,57,53,0.35)',  bg: 'rgba(229,57,53,0.05)',  label: '↓ Conservative' },
    Base: { color: 'var(--brand)', border: 'var(--border-brand)',   bg: 'var(--brand-dim)',       label: '→ Most Likely'  },
    Bull: { color: 'var(--gain)',  border: 'rgba(45,181,98,0.35)',  bg: 'rgba(45,181,98,0.05)',  label: '↑ Optimistic'   },
  };

  // Chart data: FCF by year
  const chartData = projections.rows.map(r => ({ name: r.year, fcf: r.fcf, pvFcf: r.pvFcf }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, boxShadow: 'var(--shadow-elevated)' }}>
        <p style={{ fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.fill === 'transparent' ? 'var(--tx-3)' : p.fill, marginBottom: 2 }}>
            {p.name}: ₹{p.value.toLocaleString('en-IN')} Cr
          </p>
        ))}
      </div>
    );
  };

  const hasAccess = usePlanAccess('premium');
  if (!hasAccess) return <PlanGate requires="premium" feature="DCF Builder" mode="replace"><></></PlanGate>;

  return (
    <motion.div initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0 }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <motion.div variants={cardVariant} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: 'var(--tx)', letterSpacing: '-0.025em' }}>DCF Valuation Builder</h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(0,200,150,0.12)', color: '#059669', border: '1px solid rgba(0,200,150,0.25)' }}>LIVE</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', wordBreak: 'break-word' }}>
            {stock.name} ({stock.ticker}) · 7-Year Discounted Cash Flow · Institutional-grade model
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/app/stock/${ticker}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <ChevronLeft size={14} /> Back
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="btn-primary btn-glow"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13 }}>
            <Download size={14} /> Export Excel
          </motion.button>
        </div>
      </motion.div>

      {/* ── SCENARIO SUMMARY CARDS ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 14 }}>
        {(Object.entries(dcf) as [string, number][]).map(([scenario, price]) => {
          const livePrice = scenario === 'Bear' ? liveDcfQuery.data?.scenarios?.bear
            : scenario === 'Base' ? liveDcfQuery.data?.scenarios?.base
            : liveDcfQuery.data?.scenarios?.bull;
          const sp = livePrice ?? price;
          const upside = ((sp - stock.price) / stock.price * 100).toFixed(1);
          const cfg = scenarioConfig[scenario as keyof typeof scenarioConfig];
          return (
            <motion.div key={scenario} variants={cardVariant}
              style={{ padding: '20px 22px', borderRadius: 'var(--r-lg)', border: `1px solid ${cfg.border}`, background: cfg.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>{scenario} Case</span>
                <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
              </div>
              <div className="num" style={{ fontSize: 32, fontWeight: 900, color: cfg.color, marginBottom: 4, letterSpacing: '-0.02em' }}>
                ₹{sp.toLocaleString('en-IN')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: parseFloat(upside) >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                  {parseFloat(upside) >= 0 ? '+' : ''}{upside}% vs CMP
                </span>
                <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>CMP ₹{stock.price}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── MAIN 2-COLUMN GRID ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 300px) minmax(0, 1fr)', gap: 18, alignItems: 'start', minWidth: 0 }}>

        {/* LEFT — INPUTS ─────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 20 }}>Model Assumptions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'WACC',                key: 'wacc',           value: wacc,          set: setWacc,          min: 8,   max: 18, step: 0.5, unit: '%', desc: 'Weighted Average Cost of Capital' },
                { label: 'Revenue CAGR',         key: 'revCagr',        value: revCagr,        set: setRevCagr,        min: -10, max: 50, step: 1,   unit: '%', desc: '7-year revenue growth rate'       },
                { label: 'EBITDA Margin',        key: 'ebitdaMargin',   value: ebitdaMargin,   set: setEbitdaMargin,   min: 1,   max: 50, step: 0.5, unit: '%', desc: 'Target EBITDA margin'              },
                { label: 'CapEx % of Revenue',   key: 'capexPct',       value: capexPct,       set: setCapexPct,       min: 1,   max: 30, step: 0.5, unit: '%', desc: 'Capital expenditure intensity'     },
                { label: 'Terminal Growth Rate', key: 'terminalGrowth', value: terminalGrowth, set: setTerminalGrowth, min: 2,   max: 8,  step: 0.5, unit: '%', desc: 'Perpetuity growth rate'            },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{f.desc}</div>
                    </div>
                    <span className="num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{f.value}{f.unit}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                    onChange={e => f.set(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2 }}>
                    <span>{f.min}{f.unit}</span><span>{f.max}{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* WACC Breakdown */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>WACC Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { label: 'Risk-free rate (10Y G-Sec)', value: '7.10%' },
                { label: 'Equity Risk Premium',        value: '5.50%' },
                { label: 'Beta',                       value: '1.24'  },
                { label: 'Cost of Equity',             value: `${(7.10 + 1.24 * 5.50).toFixed(1)}%` },
                { label: 'Cost of Debt (post-tax)',    value: `${(8.5 * 0.75).toFixed(1)}%` },
                { label: 'Debt / Total Capital',       value: '22.5%' },
                { label: 'WACC (blended)',              value: `${wacc}%`, highlight: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx-3)' }}>{r.label}</span>
                  <span style={{ color: r.highlight ? 'var(--brand)' : 'var(--tx)', fontWeight: r.highlight ? 700 : 600 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Value Bridge summary */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Value Bridge (Base)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'PV of FCF (Y1–Y7)',     value: fmt(projections.pvFcfSum),    color: 'var(--brand)' },
                { label: 'PV of Terminal Value',   value: fmt(projections.pvTerminalValue), color: '#6366f1'  },
                { label: 'Enterprise Value',        value: fmt(projections.enterpriseValue), color: 'var(--tx)', bold: true },
                { label: '— Net Debt',             value: `(${fmt(netDebt)})`,          color: 'var(--loss)'  },
                { label: 'Equity Value',            value: fmt(projections.equityValue), color: 'var(--tx)', bold: true },
                { label: '÷ Shares Outstanding',   value: `${shares}M`,                 color: 'var(--tx-3)'  },
                { label: 'Implied Price / Share',  value: `₹${projections.impliedPrice.toLocaleString('en-IN')}`, color: 'var(--brand)', bold: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'var(--tx-3)' }}>{r.label}</span>
                  <span style={{ color: r.color, fontWeight: r.bold ? 700 : 600 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT — OUTPUTS ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* FCF Projections — Chart or Table toggle */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>7-Year Cash Flow Projections</h3>
                <p style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>Revenue → EBITDA → FCF → Present Value</p>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3 }}>
                {([['chart', BarChart2], ['table', Table2]] as const).map(([v, Icon]) => (
                  <button key={v} onClick={() => setOutputView(v as OutputView)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: outputView === v ? 'var(--brand)' : 'transparent', color: outputView === v ? '#fff' : 'var(--tx-3)', fontFamily: 'inherit', transition: 'all 150ms' }}>
                    <Icon size={12} /> {v === 'chart' ? 'Chart' : 'Table'}
                  </button>
                ))}
              </div>
            </div>

            {outputView === 'chart' ? (
              <div style={{ paddingBottom: 8 }}>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 8 }} barCategoryGap="28%" barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--tx-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `₹${fmtShort(v)}`} tick={{ fill: 'var(--tx-3)', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="fcf" name="FCF (Nominal)" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i < 3 ? '#6366f1' : i < 5 ? 'var(--brand)' : '#10b981'} />
                        ))}
                      </Bar>
                      <Bar dataKey="pvFcf" name="PV of FCF" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i < 3 ? '#818cf8' : i < 5 ? '#fb923c' : '#34d399'} fillOpacity={0.55} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Proper legend showing all 3 phase colours */}
                <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { label: 'FCF Y1–Y3',    solid: '#6366f1', light: '#818cf8' },
                    { label: 'FCF Y4–Y5',    solid: 'var(--brand)', light: '#fb923c' },
                    { label: 'FCF Y6–Y7',    solid: '#10b981', light: '#34d399' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--tx-3)' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <div style={{ width: 8, height: 12, borderRadius: '2px 0 0 2px', background: l.solid }} />
                        <div style={{ width: 8, height: 12, borderRadius: '0 2px 2px 0', background: l.light }} />
                      </div>
                      <span>{l.label} · PV</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      {['Year', 'Revenue', 'EBITDA', 'EBITDA%', 'D&A', 'CapEx', 'FCF', 'Disc.×', 'PV(FCF)'].map((h, i) => (
                        <th key={h} style={{ padding: '9px 11px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projections.rows.map((r, i) => (
                      <tr key={r.year} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-elevated)' }}>
                        <td style={{ padding: '9px 11px', fontWeight: 700, color: 'var(--tx)', fontSize: 12 }}>{r.year}</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: 'var(--tx)' }}>{r.revenue.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: '#6366f1', fontWeight: 600 }}>{r.ebitda.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: 'var(--tx-2)' }}>{r.ebitdaMarginPct}%</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: 'var(--tx-3)' }}>{r.depreciation.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: 'var(--loss)', opacity: 0.8 }}>({r.capex.toLocaleString('en-IN')})</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: r.fcf >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 700 }}>
                          {r.fcf >= 0 ? r.fcf.toLocaleString('en-IN') : `(${Math.abs(r.fcf).toLocaleString('en-IN')})`}
                        </td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: 'var(--tx-3)' }}>{r.discFactor}</td>
                        <td className="num" style={{ textAlign: 'right', padding: '9px 11px', color: '#a78bfa', fontWeight: 600 }}>{r.pvFcf.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {/* PV of FCF subtotal */}
                    <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-md)' }}>
                      <td colSpan={8} style={{ padding: '8px 11px', fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        PV of FCFs (Sum Y1–Y7)
                      </td>
                      <td className="num" style={{ textAlign: 'right', padding: '8px 11px', fontWeight: 800, color: '#a78bfa' }}>{projections.pvFcfSum.toLocaleString('en-IN')}</td>
                    </tr>
                    {/* Terminal value */}
                    <tr style={{ background: 'var(--brand-dim)' }}>
                      <td colSpan={8} style={{ padding: '8px 11px', fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        PV of Terminal Value (TGR {terminalGrowth}%)
                      </td>
                      <td className="num" style={{ textAlign: 'right', padding: '8px 11px', fontWeight: 800, color: 'var(--brand)' }}>{projections.pvTerminalValue.toLocaleString('en-IN')}</td>
                    </tr>
                    {/* Enterprise value */}
                    <tr style={{ background: 'rgba(99,102,241,0.08)', borderTop: '2px solid var(--border-md)' }}>
                      <td colSpan={8} style={{ padding: '10px 11px', fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Enterprise Value
                      </td>
                      <td className="num" style={{ textAlign: 'right', padding: '10px 11px', fontWeight: 900, fontSize: 13, color: '#6366f1' }}>{projections.enterpriseValue.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, padding: '16px 0 4px' }}>
                  {[
                    { label: 'Enterprise Value',    val: fmt(projections.enterpriseValue),    color: '#6366f1' },
                    { label: 'Equity Value',         val: fmt(projections.equityValue),        color: 'var(--tx)' },
                    { label: 'Implied Price/Share',  val: `₹${projections.impliedPrice.toLocaleString('en-IN')}`, color: 'var(--brand)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                      <p className="num" style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</p>
                      {s.label.includes('Price') && (
                        <p style={{ fontSize: 11.5, fontWeight: 700, color: parseFloat(projections.upside) >= 0 ? 'var(--gain)' : 'var(--loss)', marginTop: 3 }}>
                          {parseFloat(projections.upside) >= 0 ? '+' : ''}{projections.upside}% vs CMP
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Sensitivity table */}
          <motion.div variants={cardVariant} className="glass-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Sensitivity Analysis</h3>
              <Info size={13} color="var(--tx-3)" />
              {!isMobile && <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>WACC (↓) vs Terminal Growth (→) · Implied Price/Share</span>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--tx-3)', fontWeight: 600, fontSize: 11 }}>WACC / TGR</th>
                    {tgRange.map(tg => (
                      <th key={tg} style={{ textAlign: 'center', padding: '8px 10px', color: tg === terminalGrowth ? 'var(--brand)' : 'var(--tx-2)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {tg === terminalGrowth ? `${tg}% ★` : `${tg}%`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waccRange.map(w => (
                    <tr key={w}>
                      <td style={{ padding: '6px 10px', color: w === wacc ? 'var(--brand)' : 'var(--tx-2)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {w === wacc ? `${w.toFixed(1)}% ★` : `${w.toFixed(1)}%`}
                      </td>
                      {tgRange.map(tg => {
                        const implied = impliedAt(w, tg);
                        const cs = getCellStyle(implied);
                        const isBase = w === wacc && tg === terminalGrowth;
                        return (
                          <td key={tg} style={{ padding: '7px 10px', textAlign: 'center', borderRadius: 8, fontWeight: cs.fontWeight, background: isBase ? 'rgba(244,117,32,0.2)' : cs.background, color: isBase ? 'var(--brand)' : cs.color, border: isBase ? '1px solid rgba(244,117,32,0.5)' : 'none' }}>
                            ₹{implied.toLocaleString('en-IN')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { bg: 'rgba(45,181,98,0.18)',   label: '+30%+ upside',    color: '#15803d' },
                { bg: 'rgba(45,181,98,0.09)',   label: '+10–30% upside',  color: '#15803d' },
                { bg: 'var(--bg-elevated)',     label: 'Fair value zone', color: 'var(--tx-3)' },
                { bg: 'rgba(244,117,32,0.1)',   label: '10–30% downside', color: 'var(--brand)' },
                { bg: 'rgba(229,57,53,0.12)',   label: '30%+ downside',   color: '#b91c1c' },
              ].map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: l.color }}>
                  <div style={{ width: 12, height: 12, borderRadius: 4, background: l.bg, border: '1px solid var(--border)' }} />
                  {l.label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Export / Live signal banner */}
          <motion.div variants={cardVariant}
            style={{ padding: '20px 24px', borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg,rgba(244,117,32,0.1) 0%,rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(244,117,32,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>Export Professional DCF Model</div>
              <div style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: liveDcfQuery.data ? 6 : 0 }}>
                4-sheet Excel: Assumptions · Projections · Sensitivity · Valuation Summary
              </div>
              {liveDcfQuery.data?.recommendation && (
                <div style={{ fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, marginTop: 4 }}>
                  Live AI signal: <strong>{liveDcfQuery.data.recommendation}</strong> · Intrinsic ₹{liveDcfQuery.data.intrinsic_value_per_share?.toLocaleString('en-IN')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="btn-primary btn-glow"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', fontSize: 13.5 }}>
                <Download size={14} /> Excel
              </motion.button>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: '1px solid var(--border-md)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'inherit' }}>
                <TrendingUp size={14} /> PDF
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
