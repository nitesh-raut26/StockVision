import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, CheckCircle, Target, GraduationCap, Home, Sunset, Shield, ToggleLeft, ToggleRight, Table2, BarChart2, Info, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { saveGoal, fetchGoals } from '../lib/api';
import { useIsMobile } from '../hooks/useBreakpoint';

// India CPI historical data (MoSPI / RBI) — FY average
const INDIA_CPI = [
  { fy: 'FY16', rate: 4.9 }, { fy: 'FY17', rate: 4.5 }, { fy: 'FY18', rate: 3.6 },
  { fy: 'FY19', rate: 3.4 }, { fy: 'FY20', rate: 4.8 }, { fy: 'FY21', rate: 6.2 },
  { fy: 'FY22', rate: 5.5 }, { fy: 'FY23', rate: 6.7 }, { fy: 'FY24', rate: 5.4 },
  { fy: 'FY25', rate: 4.8 },
];
const CPI_10Y_AVG = parseFloat((INDIA_CPI.reduce((s, d) => s + d.rate, 0) / INDIA_CPI.length).toFixed(1));
const CPI_CURRENT = INDIA_CPI[INDIA_CPI.length - 1].rate;

const INFLATION_PRESETS = [
  { label: 'RBI Target',   value: 4.0, desc: 'RBI medium-term target' },
  { label: 'Current CPI',  value: CPI_CURRENT, desc: `FY25 actual: ${CPI_CURRENT}%` },
  { label: '10Y Avg',      value: CPI_10Y_AVG, desc: `FY16–FY25 avg: ${CPI_10Y_AVG}%` },
  { label: 'Conservative', value: 7.0, desc: 'Stress scenario' },
];

const goalTypes = [
  { key: 'education',  label: 'Child Education', icon: GraduationCap, default: 5000000,  alloc: [50, 30, 20] },
  { key: 'home',       label: 'Home Purchase',    icon: Home,          default: 10000000, alloc: [30, 30, 40] },
  { key: 'retirement', label: 'Retirement',       icon: Sunset,        default: 30000000, alloc: [60, 30, 10] },
  { key: 'emergency',  label: 'Emergency Fund',   icon: Shield,        default: 1500000,  alloc: [0,  20, 80] },
  { key: 'custom',     label: 'Custom Goal',      icon: Target,        default: 2500000,  alloc: [40, 40, 20] },
];

const ALLOC_META = [
  { label: 'Equity Stocks',       color: 'var(--brand)',  examples: ['HAL', 'BEL', 'HDFC Bank'] },
  { label: 'Equity Mutual Funds', color: '#6366f1',       examples: ['Quant Flexi Cap', 'PPFAS Flexi'] },
  { label: 'Debt Funds',          color: '#06b6d4',       examples: ['HDFC Short Term', 'ICICI Liquid'] },
];

interface SavedGoal { id: string; name: string; goal_type: string; target_amount: number; target_date: string; monthly_sip: number; }

export default function GoalPlanner() {
  const { authToken } = useStore();
  const isMobile = useIsMobile();
  const [goalType, setGoalType]         = useState(goalTypes[0]);
  const [targetAmount, setTargetAmount] = useState(5000000);
  const [years, setYears]               = useState(10);
  const [monthlySavings, setSavings]    = useState(15000);
  const [annualReturn, setReturn]       = useState(14);
  const [inflationOn, setInflation]     = useState(false);
  const [inflationRate, setInflationRate] = useState(CPI_10Y_AVG);
  const [showTable, setShowTable]       = useState(false);
  const [showCpiInfo, setShowCpiInfo]   = useState(false);
  const [goalSaved, setGoalSaved]       = useState(false);

  const queryClient = useQueryClient();
  const goalsQuery = useQuery({ queryKey: ['goals', authToken], queryFn: () => fetchGoals(authToken) });
  const savedGoals = (goalsQuery.data ?? []) as SavedGoal[];

  const goalMutation = useMutation({
    mutationFn: () => saveGoal({
      name: goalType.label,
      goal_type: goalType.key as 'education' | 'home' | 'retirement' | 'emergency' | 'custom',
      target_amount: targetAmount,
      target_date: new Date(new Date().getFullYear() + years, 2, 31).toISOString().split('T')[0],
      monthly_sip: monthlySavings,
    }, authToken),
    onSuccess: () => {
      setGoalSaved(true);
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const loadGoal = (g: SavedGoal) => {
    const gt = goalTypes.find(t => t.key === g.goal_type) ?? goalTypes[goalTypes.length - 1];
    setGoalType(gt);
    setTargetAmount(g.target_amount);
    setSavings(g.monthly_sip);
    const yr = new Date(g.target_date).getFullYear() - new Date().getFullYear();
    setYears(Math.min(40, Math.max(1, Number.isFinite(yr) && yr > 0 ? yr : 10)));
    setGoalSaved(false);
  };

  const plan = useMemo(() => {
    const r = annualReturn / 100 / 12;
    const n = years * 12;
    const fv = (sip: number) => Math.round(sip * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    const requiredSip = (target: number) => Math.round(target / (((Math.pow(1 + r, n) - 1) / r) * (1 + r)));

    const inflatedTarget = inflationOn
      ? Math.round(targetAmount * Math.pow(1 + inflationRate / 100, years))
      : targetAmount;

    const projectedCorpus = fv(monthlySavings);
    const totalInvested   = monthlySavings * n;
    const wealthGained    = Math.max(0, projectedCorpus - totalInvested);
    const reqSIP          = requiredSip(inflatedTarget);
    const onTrack         = projectedCorpus >= inflatedTarget;

    const chartData = Array.from({ length: years + 1 }, (_, i) => {
      const m = i * 12;
      const corpus   = i === 0 ? 0 : fv(monthlySavings) * (m / n) + monthlySavings * m * (1 - m / n);
      // More accurate per-year calculation
      const corpusY  = i === 0 ? 0 : Math.round(monthlySavings * ((Math.pow(1 + r, m) - 1) / r) * (1 + r));
      const invested = monthlySavings * m;
      const tgt      = Math.round(targetAmount * (i / years));
      const infTgt   = inflationOn ? Math.round(targetAmount * Math.pow(1 + inflationRate / 100, i)) : null;
      return { year: `Y${i}`, corpus: corpusY, invested, target: tgt, inflatedTarget: infTgt };
    });

    return { projectedCorpus, inflatedTarget, reqSIP, totalInvested, wealthGained, onTrack, chartData };
  }, [targetAmount, years, monthlySavings, annualReturn, inflationOn, inflationRate]);

  const allocation = useMemo(() =>
    goalType.alloc
      .map((pct, i) => ({ ...ALLOC_META[i], pct, sip: Math.round(monthlySavings * pct / 100) }))
      .filter(a => a.pct > 0),
    [goalType, monthlySavings]
  );

  const fmt = (n: number) =>
    n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr`
    : n >= 100000  ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${n.toLocaleString('en-IN')}`;

  if (goalSaved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Goal-Based Portfolio Planner</h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>AI-powered financial planning — define your goal, get an exact investment plan</p>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center', border: '1px solid rgba(0,200,150,0.3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={28} color="var(--gain)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>Goal Saved Successfully</h2>
          <p style={{ fontSize: 13.5, color: 'var(--tx-2)', marginBottom: 4 }}>
            {goalType.label} · <span className="num">₹{(targetAmount / 100000).toFixed(0)}L</span> in {years} years
          </p>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 28 }}>
            Your goal is tracked on the dashboard. Monthly progress updates enabled.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button onClick={() => setGoalSaved(false)}
              style={{ padding: '10px 22px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Edit Goal
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus size={14} /> Add Another Goal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Goal-Based Portfolio Planner</h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>AI-powered financial planning — define your goal, get an exact investment plan</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setInflation(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: inflationOn ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: inflationOn ? 'var(--brand-dim)' : 'transparent', color: inflationOn ? 'var(--brand)' : 'var(--tx-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms' }}
          >
            {inflationOn ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            Inflation Adjusted ({inflationRate}%)
            <span role="button" tabIndex={0}
              onClick={e => { e.stopPropagation(); setShowCpiInfo(v => !v); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowCpiInfo(v => !v); } }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}>
              <Info size={13} />
            </span>
          </button>
          {inflationOn && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {INFLATION_PRESETS.map(p => (
                <button key={p.label} onClick={() => setInflationRate(p.value)} title={p.desc}
                  style={{ padding: '5px 10px', borderRadius: 'var(--r-sm)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms', border: inflationRate === p.value ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: inflationRate === p.value ? 'var(--brand-dim)' : 'transparent', color: inflationRate === p.value ? 'var(--brand)' : 'var(--tx-3)' }}>
                  {p.label} {p.value}%
                </button>
              ))}
            </div>
          )}
          {showCpiInfo && inflationOn && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px', width: 320, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>India CPI Inflation — MoSPI Data</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {INDIA_CPI.map(d => (
                  <div key={d.fy} style={{ flex: '1 0 60px', textAlign: 'center', background: d.rate > 6 ? 'rgba(255,77,106,0.12)' : d.rate < 5 ? 'rgba(0,200,150,0.1)' : 'var(--bg-elevated)', borderRadius: 6, padding: '5px 4px' }}>
                    <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{d.fy}</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 700, color: d.rate > 6 ? 'var(--loss)' : d.rate < 5 ? 'var(--gain)' : 'var(--tx)' }}>{d.rate}%</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', lineHeight: 1.5 }}>
                10Y Avg: <strong>{CPI_10Y_AVG}%</strong> · Current (FY25): <strong>{CPI_CURRENT}%</strong> · RBI Target: <strong>4%</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved goals (loaded from /portfolio/goals; click to reopen in the planner) */}
      {savedGoals.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', marginRight: 2 }}>Saved Goals</span>
          {savedGoals.map(g => (
            <button key={g.id} onClick={() => loadGoal(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Target size={12} color="var(--brand)" /> {g.name} · <span className="num">{fmt(g.target_amount)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 14 }}>
        {[
          { label: 'Projected Corpus',              value: fmt(plan.projectedCorpus), color: plan.onTrack ? 'var(--gain)' : 'var(--gold)', sub: plan.onTrack ? 'On Track' : 'Gap Detected' },
          { label: inflationOn ? 'Inflation-Adj Target' : 'Target Amount', value: fmt(plan.inflatedTarget), color: 'var(--tx)', sub: inflationOn ? `6% p.a. over ${years}y` : `Nominal target` },
          { label: 'Required SIP',                  value: `₹${plan.reqSIP.toLocaleString('en-IN')}/mo`, color: plan.onTrack ? 'var(--tx-2)' : 'var(--loss)', sub: `You invest ₹${monthlySavings.toLocaleString('en-IN')}/mo` },
          { label: 'Wealth Gained',                 value: fmt(plan.wealthGained), color: 'var(--brand)', sub: `On ₹${fmt(plan.totalInvested)} invested` },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 4 }}>{s.label}</div>
            <div className="num" style={{ fontSize: 19, fontWeight: 800, color: s.color, letterSpacing: '-0.02em', marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="goal-planner-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 20 }}>

        {/* Left: Inputs */}
        <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Define Your Goal</h3>

          {/* Goal type buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
            {goalTypes.map(g => {
              const Icon = g.icon;
              const active = goalType.key === g.key;
              return (
                <button key={g.key}
                  onClick={() => { setGoalType(g); setTargetAmount(g.default); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-sm)', border: active ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: active ? 'var(--brand-dim)' : 'transparent', cursor: 'pointer', transition: 'all 150ms', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <Icon size={14} color={active ? 'var(--brand)' : 'var(--tx-3)'} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--brand)' : 'var(--tx-2)' }}>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Target Amount',        value: targetAmount,    set: setTargetAmount, min: 100000,  max: 100000000, step: 100000, disp: fmt(targetAmount) },
              { label: 'Time Horizon',          value: years,           set: setYears,        min: 1,       max: 40,        step: 1,      disp: `${years} years` },
              { label: 'Monthly Savings',       value: monthlySavings,  set: setSavings,      min: 1000,    max: 200000,    step: 1000,   disp: `₹${monthlySavings.toLocaleString('en-IN')}` },
              { label: 'Expected Return (p.a.)', value: annualReturn,   set: setReturn,       min: 6,       max: 20,        step: 0.5,    disp: `${annualReturn}%` },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, color: 'var(--tx-3)' }}>{f.label}</label>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{f.disp}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                  onChange={e => f.set(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--brand)' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Projection chart card */}
          <div className="card" style={{ padding: 22, border: plan.onTrack ? '1px solid rgba(0,200,150,0.25)' : '1px solid rgba(245,166,35,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: plan.onTrack ? 'var(--gain)' : 'var(--gold)' }}>
                {plan.onTrack
                  ? <><CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />On Track</>
                  : <><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />Savings Gap</>}
              </div>
              <button onClick={() => setShowTable(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showTable ? <BarChart2 size={13} /> : <Table2 size={13} />}
                {showTable ? 'Chart' : 'Year-by-Year'}
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', marginBottom: 16, lineHeight: 1.6 }}>
              {plan.onTrack
                ? `At ₹${monthlySavings.toLocaleString('en-IN')}/month, you'll reach ${fmt(plan.projectedCorpus)} — exceeding your${inflationOn ? ' inflation-adjusted' : ''} goal by ${fmt(plan.projectedCorpus - plan.inflatedTarget)}.`
                : `You need ₹${plan.reqSIP.toLocaleString('en-IN')}/month (vs ₹${monthlySavings.toLocaleString('en-IN')}) to reach your ${inflationOn ? 'inflation-adjusted ' : ''}goal of ${fmt(plan.inflatedTarget)}.`
              }
            </p>

            {showTable ? (
              <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Year', 'Invested', 'Corpus', 'Gain', 'Target'].map(h => (
                        <th key={h} style={{ textAlign: 'right', padding: '7px 10px', color: 'var(--tx-3)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.chartData.filter((_, i) => i > 0).map((row, i) => {
                      const isFinal = i + 1 === years;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: isFinal ? 'var(--brand-dim)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                          <td className="num" style={{ padding: '7px 10px', color: 'var(--tx-3)', textAlign: 'right', fontWeight: isFinal ? 700 : 400 }}>{i + 1}</td>
                          <td className="num" style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--tx-2)' }}>{fmt(row.invested)}</td>
                          <td className="num" style={{ padding: '7px 10px', textAlign: 'right', color: isFinal ? 'var(--brand)' : 'var(--tx)', fontWeight: isFinal ? 700 : 600 }}>{fmt(row.corpus)}</td>
                          <td className="num" style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--gain)' }}>+{fmt(row.corpus - row.invested)}</td>
                          <td className="num" style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--tx-3)' }}>{fmt(row.target)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                    <AreaChart data={plan.chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gpCorpus" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gpInvested" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false}
                        interval={Math.max(0, Math.ceil(years / 6) - 1)} />
                      <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={40}
                        tickFormatter={(v: number) => v >= 10000000 ? `${(v / 10000000).toFixed(0)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                        formatter={(v, name) => [fmt(Number(v)), String(name)]}
                      />
                      <Area type="monotone" dataKey="corpus"   name="Projected Corpus" stroke="var(--brand)" fill="url(#gpCorpus)"   strokeWidth={2.5} dot={false} />
                      <Area type="monotone" dataKey="invested" name="Total Invested"   stroke="#6366f1"      fill="url(#gpInvested)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                      <Area type="monotone" dataKey="target"   name="Target"           stroke="var(--loss)"  fill="none"             strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
                      {inflationOn && (
                        <Area type="monotone" dataKey="inflatedTarget" name="Inflation-Adj Target" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Chart legend */}
                <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    { color: 'var(--brand)', label: 'Projected Corpus', dash: false },
                    { color: '#6366f1',      label: 'Total Invested',   dash: true },
                    { color: 'var(--loss)',  label: 'Target',           dash: true },
                    ...(inflationOn ? [{ color: '#f59e0b', label: 'Inflation-Adj Target', dash: true }] : []),
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width={20} height={2} style={{ flexShrink: 0 }}>
                        {l.dash
                          ? <line x1="0" y1="1" x2="20" y2="1" stroke={l.color} strokeWidth={2} strokeDasharray="4 3" />
                          : <line x1="0" y1="1" x2="20" y2="1" stroke={l.color} strokeWidth={2.5} />
                        }
                      </svg>
                      <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* AI Allocation Plan */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 3 }}>AI Allocation Plan</h3>
              <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>Recommended mix for <strong>{goalType.label}</strong> over {years} years at {annualReturn}% CAGR</p>
            </div>

            {/* Allocation bar */}
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 14, gap: 1 }}>
              {allocation.map(a => (
                <div key={a.label} style={{ width: `${a.pct}%`, background: a.color, transition: 'width 300ms' }} />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allocation.map(a => (
                <div key={a.label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{a.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{a.examples.join(' · ')}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: a.color }}>₹{a.sip.toLocaleString('en-IN')}/mo</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{a.pct}% of SIP</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => goalMutation.mutate()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--brand)', border: 'none', color: '#fff', padding: '11px 0', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <CheckCircle size={14} /> {goalMutation.isPending ? 'Saving...' : 'Save Goal Plan'}
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Download size={13} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
