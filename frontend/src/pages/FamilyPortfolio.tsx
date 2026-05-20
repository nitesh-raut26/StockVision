import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PlanGate, { usePlanAccess } from '../components/ui/PlanGate';
import { Plus, Eye, EyeOff, TrendingUp, UserPlus, Shield, AlertTriangle, BarChart2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useIsMobile } from '../hooks/useBreakpoint';
import { addFamilyMember, fetchFamilyAggregate } from '../lib/api';
import { useStore } from '../store/useStore';
import Dropdown from '../components/ui/Dropdown';

const RELATIONSHIP_OPTS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Other'].map(r => ({ label: r, value: r }));

type Holding = { ticker: string; name: string; qty: number; avgCost: number; ltp: number; sector: string };

const familyMembers = [
  {
    id: '1', name: 'Nitesh Raut', relation: 'You (Family CFO)', initials: 'NR', color: 'var(--brand)',
    portfolio: 4842310, gain: 23.5, xirr: 22.1, brokers: ['Zerodha', 'Groww', 'Angel One'],
    holdings: [
      { ticker: 'RELIANCE', name: 'Reliance Industries', qty: 50,  avgCost: 2480, ltp: 2920, sector: 'Energy'  },
      { ticker: 'TCS',      name: 'Tata Consultancy',    qty: 30,  avgCost: 3600, ltp: 3890, sector: 'IT'      },
      { ticker: 'HAL',      name: 'HAL',                 qty: 20,  avgCost: 3420, ltp: 4200, sector: 'Defence' },
      { ticker: 'HDFCBANK', name: 'HDFC Bank',           qty: 80,  avgCost: 1560, ltp: 1680, sector: 'Banking' },
      { ticker: 'BEL',      name: 'BEL',                 qty: 500, avgCost: 200,  ltp: 298,  sector: 'Defence' },
    ] as Holding[],
  },
  {
    id: '2', name: 'Sunita Raut', relation: 'Spouse', initials: 'SR', color: 'var(--purple)',
    portfolio: 1842000, gain: 14.2, xirr: 13.8, brokers: ['Zerodha'],
    holdings: [
      { ticker: 'HDFCBANK',  name: 'HDFC Bank',          qty: 60,  avgCost: 1480, ltp: 1680, sector: 'Banking' },
      { ticker: 'INFY',      name: 'Infosys',             qty: 40,  avgCost: 1380, ltp: 1540, sector: 'IT'      },
      { ticker: 'SUNPHARMA', name: 'Sun Pharma',          qty: 50,  avgCost: 1020, ltp: 1195, sector: 'Pharma'  },
      { ticker: 'RELIANCE',  name: 'Reliance Industries', qty: 25,  avgCost: 2520, ltp: 2920, sector: 'Energy'  },
    ] as Holding[],
  },
  {
    id: '3', name: 'Rajesh Raut', relation: 'Father', initials: 'RR', color: '#06B6D4',
    portfolio: 3120000, gain: 8.4, xirr: 7.9, brokers: ['ICICI Direct'],
    holdings: [
      { ticker: 'SBIN',       name: 'SBI',                 qty: 200, avgCost: 520, ltp: 625,  sector: 'Banking' },
      { ticker: 'TCS',        name: 'Tata Consultancy',    qty: 20,  avgCost: 3200, ltp: 3890, sector: 'IT'     },
      { ticker: 'NTPC',       name: 'NTPC',                qty: 300, avgCost: 210, ltp: 345,  sector: 'Energy'  },
      { ticker: 'BAJFINANCE', name: 'Bajaj Finance',       qty: 15,  avgCost: 6400, ltp: 7820, sector: 'NBFC'  },
    ] as Holding[],
  },
];

const PIE_COLORS = ['var(--brand)', 'var(--purple)', '#06B6D4', 'var(--gain)'];

const SECTOR_COLORS: Record<string, string> = {
  IT:      '#6366f1',
  Banking: '#0ea5e9',
  Energy:  '#f97316',
  Defence: 'var(--brand)',
  Pharma:  '#10b981',
  NBFC:    'var(--purple)',
  FMCG:   '#eab308',
};

export default function FamilyPortfolio() {
  const isMobile = useIsMobile();
  const { authToken } = useStore();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [showInvite, setShowInvite]   = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelation, setInviteRelation] = useState('Spouse');

  const familyQuery = useQuery({
    queryKey: ['family-aggregate', authToken],
    queryFn: () => fetchFamilyAggregate(authToken),
  });
  const inviteMutation = useMutation({
    mutationFn: () => addFamilyMember({
      name: invitePhone || 'Family Member',
      relation: 'Other',
      phone: invitePhone,
    }, authToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-aggregate'] });
      setInvitePhone('');
      setShowInvite(false);
    },
  });
  const displayMembers = familyQuery.data?.members.map((member, index) => ({
    id: member.id,
    name: member.name,
    relation: member.relation,
    initials: member.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'FM',
    color: member.color || PIE_COLORS[index % PIE_COLORS.length],
    portfolio: member.portfolio,
    gain: member.gain,
    xirr: member.xirr,
    brokers: member.status === 'active' ? ['Connected'] : ['Manual'],
    holdings: [] as Holding[],
  })) ?? familyMembers;

  const total    = familyQuery.data?.totalValue ?? displayMembers.reduce((a, m) => a + m.portfolio, 0);
  const pieData  = displayMembers.map(m => ({ name: m.name, value: m.portfolio }));

  const assets = [
    { category: 'Direct Equity',  value: 5824310, pct: 64, color: 'var(--brand)'  },
    { category: 'Mutual Funds',   value: 2480000, pct: 28, color: 'var(--purple)' },
    { category: 'Fixed Deposits', value: 800000,  pct:  9, color: '#06B6D4'       },
    { category: 'Gold (Manual)',  value: 700000,  pct:  8, color: 'var(--gold)'   },
  ];

  // Overlap analysis — stocks held by 2+ members
  const tickerCount: Record<string, { name: string; members: string[]; sector: string }> = {};
  displayMembers.forEach(m => {
    m.holdings.forEach(h => {
      if (!tickerCount[h.ticker]) tickerCount[h.ticker] = { name: h.name, members: [], sector: h.sector };
      tickerCount[h.ticker].members.push(m.name.split(' ')[0]);
    });
  });
  const overlaps = Object.entries(tickerCount).filter(([, v]) => v.members.length >= 2).map(([ticker, v]) => ({ ticker, ...v }));

  // Sector allocation across family
  const sectorMap: Record<string, number> = {};
  displayMembers.forEach(m => {
    m.holdings.forEach(h => {
      const val = h.qty * h.ltp;
      sectorMap[h.sector] = (sectorMap[h.sector] || 0) + val;
    });
  });
  const totalEquity = Object.values(sectorMap).reduce((a, v) => a + v, 0);
  const sectors = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: Math.round((value / totalEquity) * 100) }))
    .sort((a, b) => b.value - a.value);

  const hasAccess = usePlanAccess('premium');
  if (!hasAccess) return <PlanGate requires="premium" feature="Family Portfolio" mode="replace"><></></PlanGate>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Family Portfolio View</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>{isMobile ? 'Manage your family investments as CFO' : 'Manage investments for your entire family from one screen — you are the Family CFO'}</p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '8px 14px' : '9px 18px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          <UserPlus size={13} /> {isMobile ? 'Add Member' : 'Add Family Member'}
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card" style={{ padding: 22, border: '1px solid var(--border-brand)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Invite Family Member</h3>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 14, lineHeight: 1.6 }}>
            They receive a link to connect their brokers. You see their portfolio as Family CFO.
          </p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            <input
              value={invitePhone}
              onChange={e => setInvitePhone(e.target.value)}
              placeholder="+91 mobile number"
              style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 14px', fontSize: 13.5, color: 'var(--tx)', outline: 'none' }}
            />
            <Dropdown options={RELATIONSHIP_OPTS} value={inviteRelation} onChange={setInviteRelation} style={{ minWidth: 130 }} />
            <button
              onClick={() => authToken ? inviteMutation.mutate() : setShowInvite(false)}
              style={{ padding: '9px 20px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : undefined }}
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      )}

      {/* Combined net worth + pie + asset breakdown */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, marginBottom: 22, flexWrap: 'wrap' }}>
          {/* Net worth */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Combined Family Net Worth</div>
            <div className="num" style={{ fontSize: 44, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              ₹{(total / 100000).toFixed(1)}L
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13.5, color: 'var(--gain)' }}>
              <TrendingUp size={14} /> Avg Family XIRR: 16.8%
            </div>
            {/* Member breakdown */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayMembers.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--tx-2)', flex: 1 }}>{m.name.split(' ')[0]}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>₹{(m.portfolio / 100000).toFixed(1)}L</span>
                  <span style={{ fontSize: 11.5, color: 'var(--tx-3)', minWidth: 40, textAlign: 'right' }}>{((m.portfolio / total) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pie */}
          <div style={{ width: 180, height: 180, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={52}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [`₹${(Number(v) / 100000).toFixed(1)}L`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset class breakdown */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Asset Class Allocation</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
            {assets.map(a => (
              <div key={a.category} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 6 }}>{a.category}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>₹{(a.value / 100000).toFixed(1)}L</div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 99 }}>
                  <div style={{ width: `${a.pct}%`, height: '100%', background: a.color, borderRadius: 99 }} />
                </div>
                <div className="num" style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 4 }}>{a.pct}% of total</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sector allocation + overlap row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Sector allocation */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={15} color="var(--brand)" />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Sector Allocation (Equity)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sectors.map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--tx-2)' }}>{s.name}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{s.pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 99 }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: SECTOR_COLORS[s.name] || 'var(--brand)', borderRadius: 99, transition: 'width 600ms ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overlap analysis */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Layers size={15} color="var(--brand)" />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Overlap Analysis</span>
          </div>
          {overlaps.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--tx-3)', padding: '16px 0' }}>No overlapping stocks found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overlaps.map(o => (
                <div key={o.ticker} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{o.ticker}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{o.name} · {o.sector}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    {o.members.map(name => (
                      <span key={name} style={{ fontSize: 11, fontWeight: 700, background: 'var(--brand-dim)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 99 }}>{name}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '10px 12px', background: 'rgba(255,166,0,0.07)', border: '1px solid rgba(255,166,0,0.2)', borderRadius: 'var(--r-sm)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>
                  Overlapping positions concentrate family risk in these stocks. Consider diversifying across members.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Family member rows with expandable holdings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayMembers.map(member => {
          const isOpen = expandedId === member.id;
          return (
            <div key={member.id} className="card" style={{ overflow: 'hidden' }}>
              {/* Member summary row */}
              <div style={{ padding: isMobile ? '14px 16px' : 18, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 12 : 16, flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: member.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {member.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{member.name}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--tx-3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 99 }}>{member.relation}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      {member.brokers.map(b => (
                        <span key={b} style={{ fontSize: 11, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 99, color: 'var(--tx-3)' }}>{b}</span>
                      ))}
                    </div>
                  </div>
                  {isMobile && (
                    <button
                      onClick={() => setExpandedId(isOpen ? null : member.id)}
                      style={{ padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: isOpen ? 'var(--brand-dim)' : 'transparent', color: isOpen ? 'var(--brand)' : 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                    >
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: isMobile ? 0 : 24 }}>
                  <div>
                    <div className="num" style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: 'var(--tx)' }}>₹{(member.portfolio / 100000).toFixed(1)}L</div>
                    <div className="num" style={{ fontSize: 12.5, color: 'var(--gain)', marginTop: 2 }}>+{member.gain}% · XIRR {member.xirr}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>{member.holdings.length} stocks</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{member.brokers.length} broker{member.brokers.length > 1 ? 's' : ''}</div>
                  </div>
                  {!isMobile && (
                    <button
                      onClick={() => setExpandedId(isOpen ? null : member.id)}
                      style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: isOpen ? 'var(--brand-dim)' : 'transparent', color: isOpen ? 'var(--brand)' : 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600 }}
                    >
                      {isOpen ? <EyeOff size={14} /> : <Eye size={14} />}
                      {isOpen ? 'Hide' : 'Holdings'}
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded holdings table */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Stock', 'Sector', 'Qty', 'Avg Cost', 'LTP', 'Value', 'P&L', 'Return'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Stock' || h === 'Sector' ? 'left' : 'right', fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {member.holdings.map(h => {
                        const value  = h.qty * h.ltp;
                        const cost   = h.qty * h.avgCost;
                        const pnl    = value - cost;
                        const retPct = ((h.ltp - h.avgCost) / h.avgCost) * 100;
                        return (
                          <tr key={h.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--tx)' }}>{h.ticker}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 1 }}>{h.name}</div>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: `${SECTOR_COLORS[h.sector] || 'var(--brand)'}20`, color: SECTOR_COLORS[h.sector] || 'var(--brand)', fontWeight: 600 }}>{h.sector}</span>
                            </td>
                            <td style={{ padding: '11px 16px', textAlign: 'right' }} className="num">{h.qty}</td>
                            <td style={{ padding: '11px 16px', textAlign: 'right' }} className="num">₹{h.avgCost.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '11px 16px', textAlign: 'right' }} className="num">₹{h.ltp.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700 }} className="num">₹{(value / 1000).toFixed(1)}K</td>
                            <td style={{ padding: '11px 16px', textAlign: 'right', color: pnl >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }} className="num">
                              {pnl >= 0 ? '+' : ''}₹{(pnl / 1000).toFixed(1)}K
                            </td>
                            <td style={{ padding: '11px 16px', textAlign: 'right', color: retPct >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 700 }} className="num">
                              {retPct >= 0 ? '+' : ''}{retPct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-card)' }}>
                        <td colSpan={5} style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--tx-3)' }}>Total</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--tx)', fontSize: 13.5 }} className="num">
                          ₹{(member.holdings.reduce((a, h) => a + h.qty * h.ltp, 0) / 100000).toFixed(2)}L
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--gain)', fontSize: 13 }} className="num">
                          +₹{((member.holdings.reduce((a, h) => a + h.qty * h.ltp, 0) - member.holdings.reduce((a, h) => a + h.qty * h.avgCost, 0)) / 1000).toFixed(1)}K
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--gain)', fontSize: 13 }} className="num">
                          +{member.gain.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setShowInvite(true)}
          style={{ width: '100%', padding: 18, borderRadius: 'var(--r-md)', border: '1px dashed var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', transition: 'all 150ms' }}
        >
          <Plus size={16} /> Add another family member
        </button>
      </div>

      {/* Privacy note */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Shield size={16} color="var(--brand)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>Privacy Controls</div>
          <div style={{ fontSize: 13, color: 'var(--tx-3)', lineHeight: 1.6 }}>
            By default each member sees only their own holdings. As Family CFO you see everything. Members can grant or revoke visibility from their Settings page.
          </div>
        </div>
      </div>
    </div>
  );
}
