import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, Calculator, SlidersHorizontal, Star } from 'lucide-react';
import Pagination from '../components/ui/Pagination';

const PER_PAGE = 10;
import { mockMutualFunds } from '../data/mockData';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { fetchMutualFunds, fetchSipProjection } from '../lib/api';

const categories = ['All', 'Flexi Cap', 'Large Cap', 'Large & Mid Cap', 'Small Cap', 'ELSS', 'Debt'];

const generateNAVData = (base: number, days = 30) => {
  let v = base * 0.85;
  return Array.from({ length: days }, (_, i) => {
    v = v * (1 + (Math.random() - 0.47) * 0.015);
    return { day: i, nav: parseFloat(v.toFixed(2)) };
  });
};

export default function MutualFunds() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [compare, setCompare] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sipAmount, setSipAmount] = useState(10000);
  const [sipYears, setSipYears] = useState(10);
  const [sipReturn, setSipReturn] = useState(15);
  const fundsQuery = useQuery({
    queryKey: ['mutual-funds', category],
    queryFn: () => fetchMutualFunds(category),
  });
  const sipQuery = useQuery({
    queryKey: ['sip-calculator', sipAmount, sipYears, sipReturn],
    queryFn: () => fetchSipProjection(sipAmount, sipReturn / 100, sipYears),
  });
  const allFunds = fundsQuery.data ?? mockMutualFunds;

  const filtered = useMemo(() => allFunds.filter(f =>
    (category === 'All' || f.category === category) &&
    (f.name.toLowerCase().includes(search.toLowerCase()) || f.amc.toLowerCase().includes(search.toLowerCase()))
  ), [allFunds, search, category]);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageFunds = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const fallbackMonths = sipYears * 12;
  const fallbackMonthlyRate = sipReturn / 100 / 12;
  const fallbackCorpus = Math.round(sipAmount * ((Math.pow(1 + fallbackMonthlyRate, fallbackMonths) - 1) / fallbackMonthlyRate) * (1 + fallbackMonthlyRate));
  const corpus = Math.round(sipQuery.data?.futureValue ?? fallbackCorpus);
  const invested = Math.round(sipQuery.data?.totalInvested ?? (sipAmount * fallbackMonths));

  const overlappingHoldings = useMemo(() => {
    if (compare.length < 2) return 0;
    const f1 = filtered.find(f => f.id === compare[0]) ?? allFunds.find(f => f.id === compare[0]);
    const f2 = filtered.find(f => f.id === compare[1]) ?? allFunds.find(f => f.id === compare[1]);
    if (!f1 || !f2) return 0;
    const common = f1.topHoldings.filter(h => f2.topHoldings.includes(h));
    return Math.round((common.length / Math.max(f1.topHoldings.length, f2.topHoldings.length)) * 100);
  }, [allFunds, compare, filtered]);

  const toggleCompare = (id: string) => {
    setCompare(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Mutual Fund Intelligence</h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>2,000+ funds with overlap analysis and AI-powered recommendations</p>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search funds or AMC..."
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, fontSize: 13.5, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{ padding: '8px 14px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: category === c ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: category === c ? 'var(--brand-dim)' : 'transparent', color: category === c ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms' }}
            >
              {c}
            </button>
          ))}
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <SlidersHorizontal size={13} />
          More Filters
        </button>
      </div>

      {/* Overlap banner */}
      {compare.length === 2 && (
        <div style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', border: `1px solid ${overlappingHoldings >= 40 ? 'rgba(255,77,106,0.3)' : 'rgba(0,200,150,0.3)'}`, background: overlappingHoldings >= 40 ? 'rgba(255,77,106,0.07)' : 'rgba(0,200,150,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: overlappingHoldings >= 40 ? 'var(--loss)' : 'var(--gain)' }}>
              Portfolio Overlap: {overlappingHoldings}%
            </span>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', marginTop: 4 }}>
              {overlappingHoldings >= 40
                ? 'High overlap detected. These funds may not provide meaningful diversification.'
                : 'Good diversification. These funds have low holding overlap.'
              }
            </p>
          </div>
          <button onClick={() => setCompare([])} style={{ padding: '6px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      )}

      <div className="funds-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* Fund list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pageFunds.map(fund => {
            const navData = generateNAVData(fund.aum / 100);
            const inCompare = compare.includes(fund.id);
            return (
              <div
                key={fund.id}
                className="card"
                style={{ padding: 20, border: inCompare ? '1px solid var(--border-brand)' : '1px solid var(--border)', transition: 'border-color 150ms' }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{fund.name}</h3>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: fund.rating }).map((_, i) => (
                          <Star key={i} size={10} fill="var(--gold)" color="var(--gold)" />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{fund.amc}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--brand-dim)', color: 'var(--brand)' }}>{fund.category}</span>
                      <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>AUM ₹{(fund.aum / 100).toFixed(0)}Cr</span>
                    </div>
                  </div>
                  <div style={{ width: 90, height: 44, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                      <LineChart data={navData}>
                        <Line type="monotone" dataKey="nav" stroke="var(--brand)" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Returns grid */}
                <div className="funds-returns-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  {[
                    ['1Y Return', `${fund.returns1y}%`],
                    ['3Y Return', `${fund.returns3y}%`],
                    ['5Y Return', `${fund.returns5y}%`],
                    ['Expense', `${fund.expenseRatio}%`],
                  ].map(([label, value], i) => (
                    <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? 'var(--gain)' : 'var(--tx)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Holdings tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>Holdings:</span>
                  {fund.topHoldings.slice(0, 3).map(h => (
                    <span key={h} style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 99, border: '1px solid var(--border)', color: 'var(--tx-3)', background: 'var(--bg-elevated)' }}>{h}</span>
                  ))}
                </div>

                {/* Bottom row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                    {fund.fundManager} &middot; {fund.managerTenure.toFixed(1)}y tenure
                  </span>
                  <button
                    onClick={() => toggleCompare(fund.id)}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer', border: inCompare ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: inCompare ? 'var(--brand-dim)' : 'transparent', color: inCompare ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms' }}
                  >
                    {inCompare ? 'In Compare' : '+ Compare'}
                  </button>
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onPageChange={p => { setPage(p); }} totalItems={filtered.length} perPage={PER_PAGE} />
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* SIP Calculator */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Calculator size={15} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>SIP Calculator</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Monthly SIP', value: sipAmount, set: setSipAmount, min: 500, max: 100000, step: 500, fmt: (v: number) => `₹${v.toLocaleString('en-IN')}` },
                { label: 'Time Horizon', value: sipYears, set: setSipYears, min: 1, max: 40, step: 1, fmt: (v: number) => `${v} yrs` },
                { label: 'Expected Return', value: sipReturn, set: setSipReturn, min: 5, max: 30, step: 0.5, fmt: (v: number) => `${v}% p.a.` },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{f.label}</span>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{f.fmt(f.value)}</span>
                  </div>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={f.value}
                    onChange={e => f.set(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--brand)' }}
                  />
                </div>
              ))}

              <div style={{ background: 'linear-gradient(135deg, rgba(244,117,32,0.15) 0%, rgba(167,139,250,0.1) 100%)', border: '1px solid rgba(244,117,32,0.25)', borderRadius: 'var(--r-md)', padding: '16px 18px', marginTop: 4 }}>
                <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected Corpus</div>
                <div className="num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>₹{(corpus / 100000).toFixed(1)}L</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Invested: <span className="num" style={{ color: 'var(--tx-2)' }}>₹{(invested / 100000).toFixed(1)}L</span></span>
                  <span style={{ fontSize: 12, color: 'var(--gain)' }}>Gains: <span className="num">₹{((corpus - invested) / 100000).toFixed(1)}L</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Fund Suggestion */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TrendingUp size={15} color="var(--brand)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>AI Portfolio Suggestion</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 14, lineHeight: 1.6 }}>Goal: ₹50L in 10 years, moderate risk</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { fund: 'Parag Parikh Flexi Cap', alloc: 40, sip: 4000, reason: 'Low overlap, global diversification' },
                { fund: 'Quant Flexi Cap', alloc: 40, sip: 4000, reason: 'High alpha, momentum strategy' },
                { fund: 'SBI Small Cap', alloc: 20, sip: 2000, reason: 'Small cap satellite for returns kicker' },
              ].map(s => (
                <div key={s.fund} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{s.fund}</span>
                    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>{s.alloc}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="num" style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>₹{s.sip.toLocaleString('en-IN')}/mo</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{s.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11.5, color: 'var(--tx-3)', lineHeight: 1.7 }}>
              Past returns are not indicative of future performance. Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
