import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Home, Percent, Calculator,
  BarChart3, PiggyBank, CreditCard, Layers, Building2,
  ChevronDown, ChevronUp, Check,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { useIsMobile } from '../hooks/useBreakpoint';

type CalcKey = 'sip' | 'swp' | 'lumpsum' | 'fd' | 'rd' | 'ppf' | 'emi' | 'realestate' | 'cagr';

interface CalcInfo {
  definition: string;
  howItWorks: string;
  bestFor: string[];
  keyPoints: string[];
  formula: string;
  tag: string;
  tagColor: string;
}

const calcTypes: {
  key: CalcKey; label: string; icon: React.ElementType;
  desc: string; color: string; info: CalcInfo;
}[] = [
  {
    key: 'sip', label: 'SIP', icon: TrendingUp, desc: 'Systematic Investment Plan', color: '#22c55e',
    info: {
      definition: 'SIP (Systematic Investment Plan) is a method of investing a fixed amount regularly — typically every month — into mutual funds or stocks. Just like a recurring bank deposit, but in the market.',
      howItWorks: 'Every month, a fixed amount is auto-debited from your bank and invested at the prevailing NAV. Over time, you accumulate more units when prices are low and fewer when prices are high — this is called Rupee Cost Averaging.',
      bestFor: ['Salaried professionals', 'First-time investors', 'Long-term wealth building (5–30 yrs)', 'Retirement & education planning'],
      keyPoints: [
        'Reduces timing risk — you invest in all market conditions automatically',
        'Power of compounding: small monthly amounts grow massively over decades',
        'Minimum ₹100/month to get started in most mutual funds',
        'Can be paused, stopped, or modified at any time without penalty',
      ],
      formula: 'FV = P × [(1+r)ⁿ – 1] / r × (1+r)   where P = monthly amount, r = monthly rate, n = months',
      tag: 'Rupee Cost Averaging', tagColor: '#22c55e',
    },
  },
  {
    key: 'swp', label: 'SWP', icon: TrendingDown, desc: 'Systematic Withdrawal Plan', color: '#f59e0b',
    info: {
      definition: 'SWP (Systematic Withdrawal Plan) is the reverse of SIP — you invest a lumpsum corpus and withdraw a fixed amount every month. Your remaining corpus stays invested and continues earning returns.',
      howItWorks: 'You park a large corpus (e.g., retirement savings) in a mutual fund. Every month, a fixed amount is redeemed and credited to your bank account. The balance keeps compounding, so withdrawals can last much longer than if you just spent the corpus.',
      bestFor: ['Retirees needing monthly income', 'People with large windfalls or bonuses', 'Those seeking tax-efficient income vs FD interest', 'Creating a predictable passive income stream'],
      keyPoints: [
        'More tax-efficient than FD: only the gains portion of each withdrawal is taxed',
        'Corpus continues to earn returns between withdrawals',
        'Monthly income is predictable and customizable',
        'If returns > withdrawal rate, corpus can actually grow over time',
      ],
      formula: 'Balance(n) = P(1+r)ⁿ – W × [(1+r)ⁿ – 1] / r   where P = corpus, W = monthly withdrawal, r = monthly rate',
      tag: 'Passive Income', tagColor: '#f59e0b',
    },
  },
  {
    key: 'lumpsum', label: 'Lumpsum', icon: Layers, desc: 'One-time Investment', color: '#6366f1',
    info: {
      definition: 'A Lumpsum investment means investing the entire amount at once, rather than spreading it over time. If you have a large sum (bonus, inheritance, windfall), you invest it all on a single day.',
      howItWorks: 'The entire principal is invested on day one. It then compounds at the expected rate of return annually. Since the full amount works from the start, lumpsum benefits more from compounding than SIP — but it\'s also more sensitive to market timing.',
      bestFor: ['Windfall amounts (bonus, inheritance, property sale)', 'Long investment horizons (10+ years)', 'Bearish or low-market periods — buy at lower prices', 'Those comfortable with short-term volatility'],
      keyPoints: [
        'Higher potential returns than SIP if invested at market lows',
        'Entire corpus earns compounding returns from day one',
        'Market timing risk: if you invest at a market peak, short-term loss is possible',
        'Ideal to combine with SIP — use lumpsum for existing savings, SIP for regular income',
      ],
      formula: 'FV = P × (1 + r)ⁿ   where P = principal, r = annual return rate, n = years',
      tag: 'One-Time Investment', tagColor: '#6366f1',
    },
  },
  {
    key: 'fd', label: 'Fixed Deposit', icon: PiggyBank, desc: 'FD Maturity Calculator', color: '#06b6d4',
    info: {
      definition: 'A Fixed Deposit (FD) is a savings instrument offered by banks and NBFCs where you deposit a lumpsum for a fixed period at a guaranteed interest rate. Your capital is protected and returns are predictable.',
      howItWorks: 'You deposit a principal amount for a chosen tenure (7 days to 10 years). The bank pays a fixed interest rate, compounded at agreed intervals (monthly, quarterly, half-yearly, or yearly). At maturity, you receive principal + accumulated interest.',
      bestFor: ['Risk-averse investors', 'Emergency fund parking', 'Short to medium-term goals (1–5 yrs)', 'Senior citizens (extra 0.25–0.5% interest)'],
      keyPoints: [
        'DICGC insured up to ₹5 lakh per bank — your money is protected',
        'Guaranteed returns regardless of market conditions',
        'Interest is taxable as per your income slab (add to income)',
        'Quarterly compounding FDs yield more than annual payout FDs',
      ],
      formula: 'Maturity = P × (1 + r/n)^(n×t)   where r = annual rate, n = compounding frequency, t = years',
      tag: 'Capital Protected', tagColor: '#06b6d4',
    },
  },
  {
    key: 'rd', label: 'Recurring Dep.', icon: BarChart3, desc: 'RD Maturity Calculator', color: '#8b5cf6',
    info: {
      definition: 'A Recurring Deposit (RD) is a bank savings product where you deposit a fixed amount every month for a chosen tenure. It earns a fixed interest rate (typically quarterly compounding) and matures at a guaranteed amount.',
      howItWorks: 'Each month, a fixed sum is debited from your account and deposited. Interest is calculated quarterly on the accumulated balance. At the end of the tenure, you receive total deposits + interest. Think of it as a guaranteed monthly SIP with fixed returns.',
      bestFor: ['Building a savings habit', 'Short-term goals (6 months to 5 years)', 'Emergency fund creation', 'Children\'s education or vacation fund'],
      keyPoints: [
        'No market risk — guaranteed returns backed by your bank',
        'Interest compounded quarterly in most Indian banks',
        'TDS (10%) deducted if annual interest exceeds ₹40,000 (₹50,000 for seniors)',
        'Premature withdrawal allowed with a small penalty (typically 1%)',
      ],
      formula: 'Uses quarterly compounding: effective monthly rate = (1 + r/4)^(1/3) – 1, applied each month',
      tag: 'Guaranteed Returns', tagColor: '#8b5cf6',
    },
  },
  {
    key: 'ppf', label: 'PPF', icon: Percent, desc: 'Public Provident Fund', color: '#10b981',
    info: {
      definition: 'PPF (Public Provident Fund) is a government-backed long-term savings scheme with a 15-year lock-in. It offers tax-free interest, tax-deductible contributions, and a tax-free maturity amount — making it one of India\'s safest and most tax-efficient investments.',
      howItWorks: 'You deposit between ₹500 and ₹1.5 lakh per financial year. The government declares an interest rate quarterly (currently 7.1% p.a.), compounded annually. After 15 years, the entire corpus — including interest — is 100% tax-free.',
      bestFor: ['Retirement corpus building', 'Tax saving under Section 80C (up to ₹1.5L/yr)', 'Conservative long-term investors', 'Salaried individuals without EPF access'],
      keyPoints: [
        'EEE status: Invest (exempt) + Interest (exempt) + Maturity (exempt) — all three are tax-free',
        'Sovereign guarantee — backed by Government of India, zero default risk',
        'Partial withdrawal allowed after year 7; loan facility from year 3',
        'Can be extended in 5-year blocks after the initial 15 years',
      ],
      formula: 'Each year\'s deposit compounds at 7.1%: Corpus = Σ [Annual deposit × (1.071)^(remaining years)]',
      tag: 'EEE Tax Free', tagColor: '#10b981',
    },
  },
  {
    key: 'emi', label: 'EMI', icon: CreditCard, desc: 'Loan EMI Calculator', color: '#ef4444',
    info: {
      definition: 'EMI (Equated Monthly Instalment) is the fixed monthly payment you make to repay a loan — including both the principal and interest components. Every EMI you pay gradually reduces your outstanding loan balance.',
      howItWorks: 'In the early months, most of your EMI goes towards interest and very little towards principal. As the loan progresses, the principal portion increases and interest decreases. This is called an amortization schedule.',
      bestFor: ['Home loan planning before applying', 'Car or personal loan affordability check', 'Comparing loan offers from different banks', 'Understanding true cost of borrowing'],
      keyPoints: [
        'Higher tenure = lower EMI but much higher total interest paid',
        'Even a 0.5% lower rate on a ₹50L home loan saves ~₹3–5L over 20 years',
        'Pre-payment reduces both tenure and total interest significantly',
        'Use this to check: can your monthly salary comfortably afford this EMI?',
      ],
      formula: 'EMI = P × r × (1+r)ⁿ / [(1+r)ⁿ – 1]   where P = loan amount, r = monthly rate, n = months',
      tag: 'Loan Planning', tagColor: '#ef4444',
    },
  },
  {
    key: 'realestate', label: 'Real Estate', icon: Home, desc: 'Property ROI Analysis', color: '#f97316',
    info: {
      definition: 'The Real Estate Calculator helps you analyse the true return on a property investment by accounting for all costs (down payment, EMI, maintenance) against all income sources (rental yield + capital appreciation).',
      howItWorks: 'You pay a down payment and take a home loan for the rest. The property appreciates in value each year. Meanwhile, you can earn rental income. The calculator computes your net ROI after subtracting all EMI payments from property value gains + rental income.',
      bestFor: ['First-time home buyers comparing buy vs rent', 'Real estate investors evaluating rental yield', 'Checking if a property is worth the loan burden', 'Comparing residential vs commercial property ROI'],
      keyPoints: [
        'Indian residential property has historically appreciated 6–12% per year in metro cities',
        'Rental yield in India is low (2–4%) compared to EMI cost — capital gain drives most returns',
        'Factor in maintenance (1–2% of value/yr) and vacancy periods for accurate ROI',
        'Property held >2 years qualifies for LTCG tax with indexation benefit',
      ],
      formula: 'Net ROI = (Future Property Value + Total Rent – Total Cost Invested) / Down Payment / Years × 100',
      tag: 'Property ROI', tagColor: '#f97316',
    },
  },
  {
    key: 'cagr', label: 'CAGR', icon: Calculator, desc: 'Growth Rate Calculator', color: '#ec4899',
    info: {
      definition: 'CAGR (Compound Annual Growth Rate) is the rate at which an investment has grown — or is expected to grow — from its initial value to its final value over a specific time period, assuming profits are reinvested each year.',
      howItWorks: 'CAGR smooths out volatility and gives you a single annualised growth figure. For example, if your ₹1L investment became ₹2.5L in 5 years, the CAGR is 20.1% — meaning it grew at that consistent rate each year on average.',
      bestFor: ['Comparing performance of different investments', 'Evaluating mutual fund returns vs benchmarks', 'Setting realistic return expectations', 'Calculating how much a goal will cost in future'],
      keyPoints: [
        'CAGR eliminates year-to-year volatility — useful for comparing funds over different periods',
        'Nifty 50 has delivered ~13–14% CAGR over 20 years; Small Cap ~15–18% with higher risk',
        'A 12% CAGR doubles money in ~6 years (Rule of 72: 72 ÷ CAGR = doubling time)',
        'Always compare CAGR after inflation to know your real purchasing power gain',
      ],
      formula: 'CAGR = (Final Value / Initial Value)^(1/years) – 1   |   Rule of 72: Doubling time ≈ 72 / CAGR%',
      tag: 'Return Measurement', tagColor: '#ec4899',
    },
  },
];

// ── Shared helpers ────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(2)}Cr`
  : n >= 100_000  ? `₹${(n / 100_000).toFixed(2)}L`
  : n >= 1_000    ? `₹${(n / 1_000).toFixed(1)}K`
  : `₹${Math.round(n).toLocaleString('en-IN')}`;

const yAxis = (v: number) =>
  v >= 10_000_000 ? `${(v / 10_000_000).toFixed(0)}Cr`
  : v >= 100_000  ? `${(v / 100_000).toFixed(0)}L`
  : v >= 1_000    ? `${(v / 1_000).toFixed(0)}K`
  : `${v}`;

function SliderField({ label, value, set, min, max, step, display }: {
  label: string; value: number; set: (v: number) => void;
  min: number; max: number; step: number; display: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={{ fontSize: 12, color: 'var(--tx-3)' }}>{label}</label>
        <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => set(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--brand)' }} />
    </div>
  );
}

function ResultCard({ label, value, color, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 800, color: color ?? 'var(--tx)', letterSpacing: '-0.02em', marginBottom: sub ? 3 : 0 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{sub}</div>}
    </div>
  );
}

const ttStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 };

// ── CalcInfoBox ───────────────────────────────────────────────────────────────
function CalcInfoBox({ info, color, label }: { info: CalcInfo; color: string; label: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{
      borderRadius: 'var(--r-md)',
      border: `1px solid ${color}30`,
      background: `${color}08`,
      overflow: 'hidden',
    }}>
      {/* Header row — always visible */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>What is {label}?</span>
            <span style={{
              padding: '2px 9px', borderRadius: 99,
              fontSize: 10.5, fontWeight: 700,
              background: `${color}20`, color,
              border: `1px solid ${color}40`,
              whiteSpace: 'nowrap',
            }}>
              {info.tag}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.65, margin: 0 }}>
            {info.definition}
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            border: `1px solid ${color}30`, background: 'transparent',
            color: color, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${color}20`,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 0,
        }}>
          {/* How it works */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${color}10` }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 8 }}>
              How It Works
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.65, margin: 0 }}>
              {info.howItWorks}
            </p>
          </div>

          {/* Best for */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${color}10` }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 8 }}>
              Best For
            </p>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {info.bestFor.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <span style={{ color, flexShrink: 0, marginTop: 2, fontSize: 11 }}>▸</span>
                  <span style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key points + formula */}
          <div style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 8 }}>
              Key Points
            </p>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
              {info.keyPoints.map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <Check size={12} style={{ color, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.5 }}>{pt}</span>
                </li>
              ))}
            </ul>
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--r-sm)',
              background: `${color}10`, border: `1px solid ${color}25`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 4 }}>Formula</p>
              <p className="num" style={{ fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.6, margin: 0, wordBreak: 'break-word' }}>
                {info.formula}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SIP Calculator ────────────────────────────────────────────────────────────
function SIPCalc() {
  const isMobile = useIsMobile();
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate]       = useState(12);
  const [years, setYears]     = useState(10);

  const res = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const corpus   = Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    const invested = monthly * n;
    const returns  = corpus - invested;
    const chartData = Array.from({ length: years + 1 }, (_, i) => {
      const m = i * 12;
      return { year: `Y${i}`, corpus: i === 0 ? 0 : Math.round(monthly * ((Math.pow(1 + r, m) - 1) / r) * (1 + r)), invested: monthly * m };
    });
    return { corpus, invested, returns, chartData };
  }, [monthly, rate, years]);

  const pie = [
    { name: 'Invested', value: res.invested, color: '#6366f1' },
    { name: 'Returns',  value: res.returns,  color: '#22c55e' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>SIP Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Monthly Investment" value={monthly} set={setMonthly} min={500} max={200000} step={500} display={fmt(monthly)} />
          <SliderField label="Expected Annual Return" value={rate} set={setRate} min={1} max={30} step={0.5} display={`${rate}%`} />
          <SliderField label="Investment Period" value={years} set={setYears} min={1} max={40} step={1} display={`${years} yrs`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Wealth Multiple</strong><br />
          {(res.corpus / res.invested).toFixed(2)}x over {years} years
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Total Invested" value={fmt(res.invested)} color="var(--tx-2)" sub={`${years}y × ₹${monthly.toLocaleString('en-IN')}/mo`} />
          <ResultCard label="Est. Returns" value={fmt(res.returns)} color="#22c55e" sub={`${rate}% p.a.`} />
          <ResultCard label="Total Value" value={fmt(res.corpus)} color="var(--brand)" sub={`${years}yr corpus`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Corpus Growth</p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'center' }}>
            <div style={{ width: '100%', flex: isMobile ? 'none' : '0 0 60%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sipC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sipI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(years / 5) - 1)} />
                  <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                  <Area type="monotone" dataKey="corpus"   name="Corpus"   stroke="#22c55e" fill="url(#sipC)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="invested" name="Invested" stroke="#6366f1" fill="url(#sipI)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: isMobile ? '100%' : '40%', height: isMobile ? 150 : 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 130 : '100%'}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" dataKey="value" paddingAngle={2}>
                    {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
            {pie.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{d.name} {((d.value / res.corpus) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SWP Calculator ────────────────────────────────────────────────────────────
function SWPCalc() {
  const isMobile = useIsMobile();
  const [lumpsum, setLumpsum]       = useState(2500000);
  const [withdrawal, setWithdrawal] = useState(25000);
  const [rate, setRate]             = useState(8);
  const [years, setYears]           = useState(10);

  const res = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const chartData = [];
    let balance = lumpsum;
    let totalWithdrawn = 0;

    for (let m = 1; m <= n; m++) {
      balance = balance * (1 + r) - withdrawal;
      totalWithdrawn += withdrawal;
      if (balance < 0) balance = 0;
      if (m % 12 === 0) {
        chartData.push({ year: `Y${m / 12}`, balance: Math.round(balance), totalWithdrawn });
      }
    }

    const n_exhaust =
      r > 0 && withdrawal > 0
        ? Math.log(withdrawal / (withdrawal - lumpsum * r)) / Math.log(1 + r)
        : lumpsum / withdrawal;

    return {
      finalBalance: Math.max(0, Math.round(balance)),
      totalWithdrawn,
      interestEarned: Math.max(0, Math.round(lumpsum * n * r - totalWithdrawn + Math.max(0, balance) - lumpsum)),
      durationYrs: (n_exhaust / 12).toFixed(1),
      chartData,
    };
  }, [lumpsum, withdrawal, rate, years]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>SWP Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Total Investment" value={lumpsum} set={setLumpsum} min={100000} max={10000000} step={50000} display={fmt(lumpsum)} />
          <SliderField label="Monthly Withdrawal" value={withdrawal} set={setWithdrawal} min={1000} max={200000} step={1000} display={fmt(withdrawal)} />
          <SliderField label="Expected Annual Return" value={rate} set={setRate} min={1} max={20} step={0.5} display={`${rate}%`} />
          <SliderField label="Withdrawal Period" value={years} set={setYears} min={1} max={30} step={1} display={`${years} yrs`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Fund Lasts</strong><br />
          ~{res.durationYrs} years at current rate
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Total Withdrawn" value={fmt(res.totalWithdrawn)} color="#f59e0b" sub={`${years}y × ₹${withdrawal.toLocaleString('en-IN')}/mo`} />
          <ResultCard label="Remaining Balance" value={fmt(res.finalBalance)} color={res.finalBalance > 0 ? '#22c55e' : '#ef4444'} sub={`After ${years} yrs`} />
          <ResultCard label="Initial Investment" value={fmt(lumpsum)} color="var(--tx-2)" sub={`At ${rate}% p.a.`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Balance Over Time</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="swpB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke="#f59e0b" fill="url(#swpB)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lumpsum Calculator ────────────────────────────────────────────────────────
function LumpsumCalc() {
  const isMobile = useIsMobile();
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate]           = useState(12);
  const [years, setYears]         = useState(10);

  const res = useMemo(() => {
    const corpus   = Math.round(principal * Math.pow(1 + rate / 100, years));
    const returns  = corpus - principal;
    const chartData = Array.from({ length: years + 1 }, (_, i) => ({
      year: `Y${i}`,
      corpus: Math.round(principal * Math.pow(1 + rate / 100, i)),
      invested: principal,
    }));
    return { corpus, returns, chartData };
  }, [principal, rate, years]);

  const pie = [
    { name: 'Principal', value: principal,  color: '#6366f1' },
    { name: 'Returns',   value: res.returns, color: '#22c55e' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Lumpsum Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Investment Amount" value={principal} set={setPrincipal} min={1000} max={10000000} step={1000} display={fmt(principal)} />
          <SliderField label="Expected Annual Return" value={rate} set={setRate} min={1} max={30} step={0.5} display={`${rate}%`} />
          <SliderField label="Investment Period" value={years} set={setYears} min={1} max={40} step={1} display={`${years} yrs`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Wealth Multiple</strong><br />
          {(res.corpus / principal).toFixed(2)}x in {years} years
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Principal" value={fmt(principal)} color="var(--tx-2)" />
          <ResultCard label="Est. Returns" value={fmt(res.returns)} color="#22c55e" sub={`${rate}% p.a. CAGR`} />
          <ResultCard label="Total Value" value={fmt(res.corpus)} color="var(--brand)" sub={`After ${years} yrs`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Investment Growth</p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'center' }}>
            <div style={{ width: '100%', flex: isMobile ? 'none' : '0 0 60%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lsC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lsI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(years / 5) - 1)} />
                  <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                  <Area type="monotone" dataKey="corpus"   name="Corpus"    stroke="#22c55e" fill="url(#lsC)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="invested" name="Invested"  stroke="#6366f1" fill="url(#lsI)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: isMobile ? '100%' : '40%', height: isMobile ? 150 : 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" dataKey="value" paddingAngle={2}>
                    {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
            {pie.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{d.name} {((d.value / res.corpus) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fixed Deposit Calculator ──────────────────────────────────────────────────
function FDCalc() {
  const isMobile = useIsMobile();
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate]           = useState(7);
  const [years, setYears]         = useState(5);
  const [freq, setFreq]           = useState(4);

  const freqOptions = [
    { label: 'Monthly', value: 12 },
    { label: 'Quarterly', value: 4 },
    { label: 'Half-Yearly', value: 2 },
    { label: 'Yearly', value: 1 },
  ];

  const res = useMemo(() => {
    const maturity = Math.round(principal * Math.pow(1 + rate / 100 / freq, freq * years));
    const interest = maturity - principal;
    const chartData = Array.from({ length: years + 1 }, (_, i) => ({
      year: `Y${i}`,
      maturity: Math.round(principal * Math.pow(1 + rate / 100 / freq, freq * i)),
      principal,
    }));
    const effectiveRate = (Math.pow(1 + rate / 100 / freq, freq) - 1) * 100;
    return { maturity, interest, chartData, effectiveRate };
  }, [principal, rate, years, freq]);

  const pie = [
    { name: 'Principal', value: principal,    color: '#06b6d4' },
    { name: 'Interest',  value: res.interest, color: '#22c55e' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>FD Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Principal Amount" value={principal} set={setPrincipal} min={1000} max={10000000} step={1000} display={fmt(principal)} />
          <SliderField label="Annual Interest Rate" value={rate} set={setRate} min={1} max={12} step={0.1} display={`${rate}%`} />
          <SliderField label="Tenure" value={years} set={setYears} min={1} max={10} step={1} display={`${years} yrs`} />
          <div>
            <label style={{ fontSize: 12, color: 'var(--tx-3)', display: 'block', marginBottom: 8 }}>Compounding Frequency</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {freqOptions.map(f => (
                <button key={f.value} onClick={() => setFreq(f.value)}
                  style={{ padding: '5px 10px', borderRadius: 'var(--r-sm)', border: freq === f.value ? '1px solid #06b6d4' : '1px solid var(--border)', background: freq === f.value ? 'rgba(6,182,212,0.12)' : 'transparent', color: freq === f.value ? '#06b6d4' : 'var(--tx-3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Effective Annual Rate</strong><br />
          {res.effectiveRate.toFixed(2)}% p.a.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Principal" value={fmt(principal)} color="var(--tx-2)" />
          <ResultCard label="Interest Earned" value={fmt(res.interest)} color="#22c55e" sub={`${rate}% ${freqOptions.find(f => f.value === freq)?.label}`} />
          <ResultCard label="Maturity Amount" value={fmt(res.maturity)} color="#06b6d4" sub={`After ${years} yrs`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Maturity Growth</p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'center' }}>
            <div style={{ width: '100%', flex: isMobile ? 'none' : '0 0 60%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fdM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                  <Area type="monotone" dataKey="maturity" name="Maturity" stroke="#06b6d4" fill="url(#fdM)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="principal" name="Principal" stroke="#6366f1" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: isMobile ? '100%' : '40%', height: isMobile ? 150 : 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" dataKey="value" paddingAngle={2}>
                    {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
            {pie.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{d.name} {((d.value / res.maturity) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Deposit Calculator ──────────────────────────────────────────────
function RDCalc() {
  const isMobile = useIsMobile();
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate]       = useState(7);
  const [months, setMonths]   = useState(60);

  const res = useMemo(() => {
    const monthlyRate = Math.pow(1 + rate / 100 / 4, 1 / 3) - 1;
    let balance = 0;
    for (let m = 1; m <= months; m++) {
      balance = (balance + monthly) * (1 + monthlyRate);
    }
    const maturity  = Math.round(balance);
    const invested  = monthly * months;
    const interest  = maturity - invested;
    const chartData = Array.from({ length: Math.ceil(months / 3) + 1 }, (_, qi) => {
      if (qi === 0) return { period: 'Q0', maturity: 0, invested: 0 };
      let bal = 0;
      const m = qi * 3;
      for (let i = 1; i <= Math.min(m, months); i++) {
        bal = (bal + monthly) * (1 + monthlyRate);
      }
      return { period: `Q${qi}`, maturity: Math.round(bal), invested: monthly * Math.min(m, months) };
    });
    return { maturity, invested, interest, chartData };
  }, [monthly, rate, months]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>RD Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Monthly Deposit" value={monthly} set={setMonthly} min={100} max={100000} step={100} display={fmt(monthly)} />
          <SliderField label="Annual Interest Rate" value={rate} set={setRate} min={1} max={10} step={0.1} display={`${rate}%`} />
          <SliderField label="Tenure (months)" value={months} set={setMonths} min={6} max={120} step={6} display={`${months} mo`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Effective Yield</strong><br />
          {((res.interest / res.invested) * 100 * (12 / months)).toFixed(2)}% p.a. simple
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Total Deposited" value={fmt(res.invested)} color="var(--tx-2)" sub={`${months}mo × ₹${monthly.toLocaleString('en-IN')}`} />
          <ResultCard label="Interest Earned" value={fmt(res.interest)} color="#22c55e" sub={`${rate}% quarterly`} />
          <ResultCard label="Maturity Amount" value={fmt(res.maturity)} color="#8b5cf6" sub={`After ${months} months`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Quarterly Growth</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={res.chartData.filter((_, i) => i > 0)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(months / 3 / 6) - 1)} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                <Bar dataKey="invested" name="Deposited" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="maturity" name="Maturity"  fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PPF Calculator ────────────────────────────────────────────────────────────
function PPFCalc() {
  const isMobile = useIsMobile();
  const [annual, setAnnual] = useState(150000);
  const [rate, setRate]     = useState(7.1);
  const [years, setYears]   = useState(15);

  const res = useMemo(() => {
    const r = rate / 100;
    let balance  = 0;
    const chartData = [];
    let totalInvested = 0;
    for (let y = 1; y <= years; y++) {
      balance = (balance + annual) * (1 + r);
      totalInvested += annual;
      chartData.push({ year: `Y${y}`, corpus: Math.round(balance), invested: totalInvested });
    }
    const maturity  = Math.round(balance);
    const interest  = maturity - totalInvested;
    const taxSaved  = Math.round(totalInvested * 0.30);
    return { maturity, invested: totalInvested, interest, taxSaved, chartData };
  }, [annual, rate, years]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>PPF Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Annual Investment" value={annual} set={setAnnual} min={500} max={150000} step={500} display={fmt(annual)} />
          <SliderField label="Interest Rate" value={rate} set={setRate} min={6} max={9} step={0.1} display={`${rate}%`} />
          <SliderField label="Tenure" value={years} set={setYears} min={15} max={30} step={5} display={`${years} yrs`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981', lineHeight: 1.6 }}>
          <strong>EEE Status</strong> — Exempt·Exempt·Exempt<br />
          <span style={{ color: 'var(--tx-3)' }}>Invest · Interest · Maturity all tax-free u/s 80C</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
          <ResultCard label="Total Invested" value={fmt(res.invested)} color="var(--tx-2)" />
          <ResultCard label="Interest Earned" value={fmt(res.interest)} color="#22c55e" />
          <ResultCard label="Maturity Amount" value={fmt(res.maturity)} color="#10b981" sub={`After ${years} yrs`} />
          <ResultCard label="Tax Saved (30%)" value={fmt(res.taxSaved)} color="#06b6d4" sub="u/s 80C" />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>PPF Corpus Growth</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ppfC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ppfI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(years / 5) - 1)} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                <Area type="monotone" dataKey="corpus"   name="Corpus"   stroke="#10b981" fill="url(#ppfC)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="invested" name="Invested" stroke="#6366f1" fill="url(#ppfI)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EMI Calculator ────────────────────────────────────────────────────────────
function EMICalc() {
  const isMobile = useIsMobile();
  const [loanAmt, setLoanAmt]   = useState(5000000);
  const [rate, setRate]         = useState(9);
  const [tenure, setTenure]     = useState(20);
  const [showSchedule, setShowSchedule] = useState(false);

  const res = useMemo(() => {
    const r   = rate / 100 / 12;
    const n   = tenure * 12;
    const emi = Math.round(loanAmt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    const totalPayment  = emi * n;
    const totalInterest = totalPayment - loanAmt;

    const schedule = [];
    let outstanding = loanAmt;
    for (let yr = 1; yr <= tenure; yr++) {
      let yearInterest   = 0;
      let yearPrincipal  = 0;
      for (let m = 0; m < 12; m++) {
        const interest  = Math.round(outstanding * r);
        const principal = emi - interest;
        yearInterest   += interest;
        yearPrincipal  += principal;
        outstanding    -= principal;
      }
      schedule.push({
        year: `Y${yr}`,
        principal: yearPrincipal,
        interest: yearInterest,
        balance: Math.max(0, Math.round(outstanding)),
      });
    }
    return { emi, totalPayment, totalInterest, schedule };
  }, [loanAmt, rate, tenure]);

  const pie = [
    { name: 'Principal', value: loanAmt,           color: '#6366f1' },
    { name: 'Interest',  value: res.totalInterest, color: '#ef4444' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Loan Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Loan Amount" value={loanAmt} set={setLoanAmt} min={100000} max={20000000} step={100000} display={fmt(loanAmt)} />
          <SliderField label="Annual Interest Rate" value={rate} set={setRate} min={1} max={20} step={0.1} display={`${rate}%`} />
          <SliderField label="Loan Tenure" value={tenure} set={setTenure} min={1} max={30} step={1} display={`${tenure} yrs`} />
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--tx-2)' }}>Interest %</strong><br />
          {((res.totalInterest / loanAmt) * 100).toFixed(1)}% of principal
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label="Monthly EMI" value={fmt(res.emi)} color="#ef4444" sub={`For ${tenure} yrs`} />
          <ResultCard label="Total Interest" value={fmt(res.totalInterest)} color="var(--loss)" sub={`${rate}% p.a.`} />
          <ResultCard label="Total Payment" value={fmt(res.totalPayment)} color="var(--tx)" sub="Principal + Interest" />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)' }}>Amortization</p>
            <button onClick={() => setShowSchedule(v => !v)}
              style={{ padding: '4px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              {showSchedule ? 'Chart' : 'Schedule'}
            </button>
          </div>
          {showSchedule ? (
            <div style={{ overflowY: 'auto', maxHeight: 240 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Year', 'Principal', 'Interest', 'EMI Paid', 'Balance'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '7px 8px', color: 'var(--tx-3)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.schedule.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                      <td className="num" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--tx-3)' }}>{row.year}</td>
                      <td className="num" style={{ padding: '6px 8px', textAlign: 'right', color: '#6366f1' }}>{fmt(row.principal)}</td>
                      <td className="num" style={{ padding: '6px 8px', textAlign: 'right', color: '#ef4444' }}>{fmt(row.interest)}</td>
                      <td className="num" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--tx-2)' }}>{fmt(row.principal + row.interest)}</td>
                      <td className="num" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--tx)' }}>{fmt(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'center' }}>
              <div style={{ width: '100%', flex: isMobile ? 'none' : '0 0 55%', height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={res.schedule} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(tenure / 5) - 1)} />
                    <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                    <Bar dataKey="principal" name="Principal" stackId="a" fill="#6366f1" />
                    <Bar dataKey="interest"  name="Interest"  stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: isMobile ? '100%' : '45%', height: isMobile ? 150 : 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%" dataKey="value" paddingAngle={2}>
                      {pie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {!showSchedule && (
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
              {pie.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{d.name} {((d.value / res.totalPayment) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Real Estate Calculator ────────────────────────────────────────────────────
function RealEstateCalc() {
  const isMobile = useIsMobile();
  const [propPrice, setPropPrice]       = useState(10000000);
  const [downPayment, setDownPayment]   = useState(2000000);
  const [loanRate, setLoanRate]         = useState(9);
  const [tenure, setTenure]             = useState(20);
  const [appreciation, setAppreciation] = useState(8);
  const [rentalYield, setRentalYield]   = useState(3);

  const res = useMemo(() => {
    const loanAmt = propPrice - downPayment;
    const r       = loanRate / 100 / 12;
    const n       = tenure * 12;
    const emi     = loanAmt > 0
      ? Math.round(loanAmt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1))
      : 0;
    const totalEmiPaid    = emi * n;
    const totalCost       = downPayment + totalEmiPaid;
    const futureValue     = Math.round(propPrice * Math.pow(1 + appreciation / 100, tenure));
    const totalRental     = Math.round(propPrice * rentalYield / 100 * tenure);
    const netGain         = futureValue + totalRental - totalCost;
    const roi             = ((netGain / downPayment) * 100 / tenure).toFixed(2);

    const chartData = Array.from({ length: tenure + 1 }, (_, i) => ({
      year: `Y${i}`,
      propertyValue: Math.round(propPrice * Math.pow(1 + appreciation / 100, i)),
      totalInvested: downPayment + Math.min(i, tenure) * emi * 12,
    }));
    return { emi, totalCost, futureValue, totalRental, netGain, roi, loanAmt, chartData };
  }, [propPrice, downPayment, loanRate, tenure, appreciation, rentalYield]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>Property Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Property Price" value={propPrice} set={setPropPrice} min={1000000} max={100000000} step={500000} display={fmt(propPrice)} />
          <SliderField label="Down Payment" value={downPayment} set={setDownPayment} min={0} max={propPrice} step={100000} display={fmt(downPayment)} />
          <SliderField label="Loan Interest Rate" value={loanRate} set={setLoanRate} min={6} max={15} step={0.1} display={`${loanRate}%`} />
          <SliderField label="Loan Tenure" value={tenure} set={setTenure} min={5} max={30} step={1} display={`${tenure} yrs`} />
          <SliderField label="Appreciation Rate" value={appreciation} set={setAppreciation} min={2} max={20} step={0.5} display={`${appreciation}%/yr`} />
          <SliderField label="Annual Rental Yield" value={rentalYield} set={setRentalYield} min={1} max={10} step={0.5} display={`${rentalYield}%`} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
          <ResultCard label="Monthly EMI" value={fmt(res.emi)} color="#f97316" sub={`${loanRate}% on ${fmt(res.loanAmt)}`} />
          <ResultCard label="Future Value" value={fmt(res.futureValue)} color="#22c55e" sub={`After ${tenure} years`} />
          <ResultCard label="Total Rental" value={fmt(res.totalRental)} color="#06b6d4" sub={`${rentalYield}% × ${tenure} yrs`} />
          <ResultCard label="Net ROI" value={`${res.roi}%/yr`} color={+res.roi > 0 ? 'var(--gain)' : 'var(--loss)'} sub={`Net gain ${fmt(res.netGain)}`} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Property Value vs Cost Invested</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(tenure / 5) - 1)} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={40} tickFormatter={yAxis} />
                <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                <Area type="monotone" dataKey="propertyValue" name="Property Value"  stroke="#f97316" fill="url(#reV)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="totalInvested" name="Total Invested"  stroke="#6366f1" fill="url(#reI)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
            {[
              { label: 'Down Payment', value: fmt(downPayment), color: '#6366f1' },
              { label: 'Total EMI', value: fmt(res.totalCost - downPayment), color: '#ef4444' },
              { label: 'Capital Gain', value: fmt(res.futureValue - propPrice), color: '#22c55e' },
              { label: 'Rental Income', value: fmt(res.totalRental), color: '#06b6d4' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1 0 120px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 2 }}>{s.label}</div>
                <div className="num" style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CAGR Calculator ───────────────────────────────────────────────────────────
function CAGRCalc() {
  const isMobile = useIsMobile();
  const [initial, setInitial]     = useState(100000);
  const [finalVal, setFinalVal]   = useState(250000);
  const [years, setYears]         = useState(5);
  const [mode, setMode]           = useState<'find_cagr' | 'find_final'>('find_cagr');

  const res = useMemo(() => {
    if (mode === 'find_cagr') {
      const cagr = (Math.pow(finalVal / initial, 1 / years) - 1) * 100;
      const multiple = finalVal / initial;
      const absoluteReturn = ((finalVal - initial) / initial) * 100;
      const chartData = Array.from({ length: years + 1 }, (_, i) => ({
        year: `Y${i}`,
        value: Math.round(initial * Math.pow(1 + cagr / 100, i)),
      }));
      return { cagr, multiple, absoluteReturn, chartData, displayFinal: finalVal };
    } else {
      const cagrInput = +((finalVal / initial).toFixed(2));
      const computedFinal = Math.round(initial * Math.pow(1 + cagrInput / 100, years));
      const multiple = computedFinal / initial;
      const chartData = Array.from({ length: years + 1 }, (_, i) => ({
        year: `Y${i}`,
        value: Math.round(initial * Math.pow(1 + cagrInput / 100, i)),
      }));
      return { cagr: cagrInput, multiple, absoluteReturn: (multiple - 1) * 100, chartData, displayFinal: computedFinal };
    }
  }, [initial, finalVal, years, mode]);

  const benchmarks = [
    { label: 'FD (7%)',      cagr: 7,    color: '#06b6d4' },
    { label: 'Nifty 50',    cagr: 13.5,  color: '#22c55e' },
    { label: 'Sensex',      cagr: 14,    color: '#f59e0b' },
    { label: 'Small Cap',   cagr: 16,    color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 14 }}>CAGR Calculator</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[
            { key: 'find_cagr' as const,  label: 'Find CAGR' },
            { key: 'find_final' as const, label: 'Find Value' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 'var(--r-sm)', border: mode === m.key ? '1px solid #ec4899' : '1px solid var(--border)', background: mode === m.key ? 'rgba(236,72,153,0.12)' : 'transparent', color: mode === m.key ? '#ec4899' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SliderField label="Initial Value" value={initial} set={setInitial} min={1000} max={10000000} step={1000} display={fmt(initial)} />
          <SliderField
            label={mode === 'find_cagr' ? 'Final Value' : 'Expected CAGR (%)'}
            value={finalVal}
            set={setFinalVal}
            min={mode === 'find_cagr' ? initial : 1}
            max={mode === 'find_cagr' ? initial * 100 : 50}
            step={mode === 'find_cagr' ? 1000 : 0.5}
            display={mode === 'find_cagr' ? fmt(finalVal) : `${finalVal}%`}
          />
          <SliderField label="Duration" value={years} set={setYears} min={1} max={40} step={1} display={`${years} yrs`} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
          <ResultCard label={mode === 'find_cagr' ? 'CAGR' : 'Future Value'} value={mode === 'find_cagr' ? `${res.cagr.toFixed(2)}%` : fmt(res.displayFinal)} color="#ec4899" sub="Compound Annual Growth" />
          <ResultCard label="Growth Multiple" value={`${res.multiple.toFixed(2)}x`} color="var(--brand)" sub={`Over ${years} yrs`} />
          <ResultCard label="Absolute Return" value={`${res.absoluteReturn.toFixed(1)}%`} color="#22c55e" sub="Total % gain" />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 12 }}>Growth Trajectory</p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={res.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cagrV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(years / 5) - 1)} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={36} tickFormatter={yAxis} />
                <Tooltip contentStyle={ttStyle} formatter={(v: unknown, n) => [fmt(Number(v)), String(n)]} />
                <Area type="monotone" dataKey="value" name="Portfolio Value" stroke="#ec4899" fill="url(#cagrV)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 8 }}>Benchmark Comparison — {fmt(initial)} over {years} yrs</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {benchmarks.map(b => {
                const bFv = Math.round(initial * Math.pow(1 + b.cagr / 100, years));
                return (
                  <div key={b.label} style={{ flex: '1 0 120px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', border: `1px solid ${b.color}30` }}>
                    <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 4 }}>{b.label} ({b.cagr}%)</div>
                    <div className="num" style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{fmt(bFv)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Calculators Page ─────────────────────────────────────────────────────
export default function Calculators() {
  const isMobile = useIsMobile();
  const [active, setActive] = useState<CalcKey>('sip');
  const current = calcTypes.find(c => c.key === active)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Financial Calculators
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>
          SIP · SWP · Lumpsum · FD · RD · PPF · EMI · Real Estate · CAGR — all in one place
        </p>
      </div>

      {/* Calculator type selector grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(9, 1fr)',
        gap: 8,
      }}>
        {calcTypes.map(c => {
          const Icon = c.icon;
          const isActive = active === c.key;
          return (
            <button key={c.key} onClick={() => setActive(c.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: isMobile ? '12px 6px' : '14px 8px',
                borderRadius: 'var(--r-md)',
                border: isActive ? `1px solid ${c.color}60` : '1px solid var(--border)',
                background: isActive ? `${c.color}14` : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 150ms',
                fontFamily: 'inherit',
              }}>
              <Icon size={18} color={isActive ? c.color : 'var(--tx-3)'} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? c.color : 'var(--tx-3)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active calculator label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 4, height: 20, background: current.color, borderRadius: 2, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{current.label} Calculator</span>
          <span style={{ fontSize: 12.5, color: 'var(--tx-3)', marginLeft: 10 }}>{current.desc}</span>
        </div>
      </div>

      {/* What is this calculator — educational info box */}
      <CalcInfoBox key={active} info={current.info} color={current.color} label={current.label} />

      {/* Calculator panels */}
      {active === 'sip'        && <SIPCalc />}
      {active === 'swp'        && <SWPCalc />}
      {active === 'lumpsum'    && <LumpsumCalc />}
      {active === 'fd'         && <FDCalc />}
      {active === 'rd'         && <RDCalc />}
      {active === 'ppf'        && <PPFCalc />}
      {active === 'emi'        && <EMICalc />}
      {active === 'realestate' && <RealEstateCalc />}
      {active === 'cagr'       && <CAGRCalc />}
    </div>
  );
}
