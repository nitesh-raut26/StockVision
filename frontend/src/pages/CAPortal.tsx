import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PlanGate, { usePlanAccess } from '../components/ui/PlanGate';
import { Briefcase, Upload, Users, FileText, CheckCircle, Download, Loader2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';
import { fetchCaClients } from '../lib/api';
import { useStore } from '../store/useStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const plans = [
  { name: 'Starter',      price: '₹5,000',  period: '/month', clients: 25,  popular: false, features: ['25 client portfolios', 'All report templates', 'White-label branding', 'Annual review reports', 'Email support'] },
  { name: 'Professional', price: '₹10,000', period: '/month', clients: 75,  popular: true,  features: ['75 client portfolios', 'Everything in Starter', 'Transaction summaries', 'Goal review reports', 'Priority support', 'Bulk CSV upload'] },
  { name: 'Enterprise',   price: '₹20,000', period: '/month', clients: -1,  popular: false, features: ['Unlimited clients', 'Everything in Pro', 'API access', 'Custom templates', 'Dedicated account manager', 'White-glove onboarding'] },
];

const demoClients = [
  { name: 'Ramesh Gupta',  portfolio: 4200000,  xirr: 18.4, lastReport: '30 Apr 2026', risk: 'Moderate', goals: 2 },
  { name: 'Anita Sharma',  portfolio: 8400000,  xirr: 14.2, lastReport: '30 Apr 2026', risk: 'Conservative', goals: 3 },
  { name: 'Vijay Patel',   portfolio: 2100000,  xirr: 22.8, lastReport: '28 Apr 2026', risk: 'Aggressive', goals: 1 },
  { name: 'Priya Mehta',   portfolio: 6300000,  xirr: 16.1, lastReport: '25 Apr 2026', risk: 'Moderate', goals: 2 },
  { name: 'Suresh Nair',   portfolio: 12500000, xirr: 11.8, lastReport: '22 Apr 2026', risk: 'Conservative', goals: 4 },
];

const RECENT_ACTIVITY = [
  { time: '2h ago',  action: 'Annual review report generated', client: 'Anita Sharma',  type: 'report' },
  { time: '5h ago',  action: 'Goal review completed',           client: 'Ramesh Gupta',  type: 'goal'   },
  { time: '1d ago',  action: 'New client onboarded',            client: 'Suresh Nair',   type: 'client' },
  { time: '2d ago',  action: 'Transaction summary exported',    client: 'Vijay Patel',   type: 'export' },
  { time: '3d ago',  action: 'Tax harvesting alert sent',       client: 'Priya Mehta',   type: 'alert'  },
];

const ACTIVITY_COLORS: Record<string, string> = {
  report: '#6366f1', goal: '#10b981', client: 'var(--brand)', export: '#06b6d4', alert: '#f59e0b',
};

const INPUT_STYLE = {
  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  padding: '10px 14px', fontSize: 13.5, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};

const riskColor: Record<string, string> = { Moderate: '#6366f1', Conservative: '#10b981', Aggressive: '#ef4444' };

export default function CAPortal() {
  const isMobile = useIsMobile();
  const { authToken } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing'>('dashboard');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);

  const handleGenerate = (key: string) => {
    setGenerating(key);
    setTimeout(() => { setGenerating(null); setGenerated(prev => [...prev, key]); }, 2000);
  };

  const clientsQuery = useQuery({
    queryKey: ['ca-clients', authToken],
    queryFn: () => fetchCaClients(authToken),
  });
  const clients = clientsQuery.data?.map((client) => ({
    name: client.name,
    portfolio: client.total_gains + client.total_tax,
    xirr: client.total_gains ? Math.min(35, Math.max(5, client.total_gains / 50000)) : 10,
    lastReport: client.last_updated,
    risk: client.filing_status === 'OVERDUE' ? 'Aggressive' : client.filing_status === 'FILED' ? 'Conservative' : 'Moderate',
    goals: client.filing_status === 'FILED' ? 3 : 1,
    filingStatus: client.filing_status,
    pan: client.pan,
  })) ?? demoClients;

  const clientChartData = clients.map(c => ({
    name: c.name.split(' ')[0],
    portfolio: c.portfolio / 100000,
    xirr: c.xirr,
  }));

  const totalAUM = clients.reduce((s, c) => s + c.portfolio, 0);
  const avgXIRR  = (clients.reduce((s, c) => s + c.xirr, 0) / clients.length).toFixed(1);

  const statCards = [
    { label: 'Active Clients',    value: clients.length,             icon: Users,       color: 'var(--brand)' },
    { label: 'Total AUM',         value: `₹${(totalAUM/10000000).toFixed(1)} Cr`, icon: Briefcase,   color: '#06B6D4'       },
    { label: 'Avg Portfolio XIRR', value: `${avgXIRR}%`,             icon: TrendingUp,  color: 'var(--gain)'  },
    { label: 'Reports This Month', value: 48,                         icon: FileText,    color: '#6366f1'       },
  ];

  const hasAccess = usePlanAccess('enterprise');
  if (!hasAccess) return <PlanGate requires="enterprise" feature="CA White-Label Portal" mode="replace"><></></PlanGate>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>CA / RIA White-Label Portal</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>{isMobile ? 'Branded client reports · ₹5,000/month' : 'Generate fully branded client reports under your firm’s name — ₹5,000–₹20,000/month'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {(['dashboard', 'pricing'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: isMobile ? '8px 14px' : '9px 18px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', textTransform: 'capitalize', border: activeTab === tab ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: activeTab === tab ? 'var(--brand-dim)' : 'transparent', color: activeTab === tab ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
            {statCards.map(s => (
              <div key={s.label} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: `${s.color}18`, border: `1px solid ${s.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={18} color={s.color} />
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--gain)', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(0,200,150,0.1)' }}>↑ vs last mo</span>
                </div>
                <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>
                  {typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AUM chart + activity feed */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 20 }}>

            {/* Client AUM bar chart */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Client Portfolio Overview</h3>
                <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>AUM in ₹ Lakhs</span>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                  <BarChart data={clientChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--tx-3)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `₹${v}L`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any, name: any) => [`₹${v}L`, name === 'portfolio' ? 'Portfolio Value' : 'XIRR %']}
                    />
                    <Bar dataKey="portfolio" name="portfolio" radius={[6, 6, 0, 0]}>
                      {clientChartData.map((_, i) => (
                        <Cell key={i} fill={i === 4 ? 'var(--brand)' : 'rgba(99,102,241,0.6)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {clients.map(c => (
                  <div key={c.name} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8, minWidth: 120 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor[c.risk], flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx)' }}>{c.name.split(' ')[0]}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>XIRR {c.xirr}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Clock size={14} color="var(--brand)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Recent Activity</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {RECENT_ACTIVITY.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACTIVITY_COLORS[a.type], flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--tx)', fontWeight: 600, marginBottom: 1 }}>{a.action}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{a.client} · {a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Firm branding */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>Firm White-Label Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { label: 'Firm Name',                defaultVal: 'Raut & Associates',  type: 'text'  },
                { label: 'ICAI Registration Number', defaultVal: 'MH-123456',          type: 'text'  },
                { label: 'Contact Email',             defaultVal: 'rautn211@gmail.com', type: 'email' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--tx-3)', marginBottom: 6, fontWeight: 500 }}>{f.label}</label>
                  <input defaultValue={f.defaultVal} type={f.type} style={INPUT_STYLE} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--tx-3)', marginBottom: 6, fontWeight: 500 }}>Firm Logo (PNG/SVG)</label>
                <button style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border-md)', background: 'var(--bg-elevated)', color: 'var(--tx-3)', fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'all 150ms' }}>
                  <Upload size={13} /> Upload Logo
                </button>
              </div>
            </div>
            <button style={{ marginTop: 16, padding: '10px 22px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Save Branding
            </button>
          </div>

          {/* Client list */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '16px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>Client Portfolio Reports</h3>
                <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>{clients.length} clients · AUM ₹{(totalAUM / 10000000).toFixed(1)} Cr · {authToken ? 'Live API' : 'Demo mode'}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Upload size={12} /> {isMobile ? 'CSV' : 'Bulk CSV'}
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Users size={12} /> {isMobile ? 'Add' : 'Add Client'}
                </button>
              </div>
            </div>
            <div>
              {clients.map((client, i) => (
                <div key={i} style={{ padding: isMobile ? '12px 16px' : '14px 22px', borderBottom: i < clients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 10 : 0 }}>
                    <div style={{ width: 38, height: 38, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{client.name}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: `${riskColor[client.risk]}15`, color: riskColor[client.risk], border: `1px solid ${riskColor[client.risk]}30` }}>{client.risk}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>{client.goals} goal{client.goals > 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>
                        <span className="num" style={{ color: 'var(--tx-2)', fontWeight: 600 }}>₹{(client.portfolio / 100000).toFixed(1)}L</span>
                        &nbsp;·&nbsp;XIRR <span className="num" style={{ color: 'var(--gain)', fontWeight: 600 }}>{client.xirr}%</span>
                        {!isMobile && <>&nbsp;·&nbsp;{client.lastReport}</>}
                      </div>
                    </div>
                    {!isMobile && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {['Annual Review', 'Transaction Summary', 'Goal Review'].map(type => {
                          const key = `${client.name}-${type}`;
                          const isDone = generated.includes(key);
                          const isLoading = generating === key;
                          return (
                            <button key={type} onClick={() => handleGenerate(key)} disabled={isLoading}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: 11.5, fontWeight: 600, cursor: isLoading ? 'default' : 'pointer', transition: 'all 150ms', border: isDone ? '1px solid rgba(0,200,150,0.35)' : '1px solid var(--border)', background: isDone ? 'rgba(0,200,150,0.08)' : 'var(--bg-elevated)', color: isDone ? 'var(--gain)' : 'var(--tx-3)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                              {isLoading ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : isDone ? <CheckCircle size={10} /> : <FileText size={10} />}
                              {isLoading ? 'Generating...' : isDone ? 'Done' : type}
                            </button>
                          );
                        })}
                        <button style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Download size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isMobile && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Annual', 'Tx Summary', 'Goal Review'].map((label, idx) => {
                        const fullType = ['Annual Review', 'Transaction Summary', 'Goal Review'][idx];
                        const key = `${client.name}-${fullType}`;
                        const isDone = generated.includes(key);
                        const isLoading = generating === key;
                        return (
                          <button key={label} onClick={() => handleGenerate(key)} disabled={isLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: isLoading ? 'default' : 'pointer', transition: 'all 150ms', border: isDone ? '1px solid rgba(0,200,150,0.35)' : '1px solid var(--border)', background: isDone ? 'rgba(0,200,150,0.08)' : 'var(--bg-elevated)', color: isDone ? 'var(--gain)' : 'var(--tx-3)', fontFamily: 'inherit' }}>
                            {isLoading ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : isDone ? <CheckCircle size={9} /> : <FileText size={9} />}
                            {isLoading ? '...' : isDone ? 'Done' : label}
                          </button>
                        );
                      })}
                      <button style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Download size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Alert banner */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'rgba(245,166,35,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={14} color="var(--gold)" />
              <span style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>3 clients</span> have tax-loss harvesting opportunities before 31 Mar deadline.
                <span style={{ color: 'var(--brand)', fontWeight: 600, cursor: 'pointer', marginLeft: 6 }}>Send alerts →</span>
              </span>
            </div>
          </div>
        </>
      ) : (
        /* Pricing */
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{ borderRadius: 'var(--r-md)', padding: 28, border: plan.popular ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)', background: plan.popular ? 'linear-gradient(135deg, rgba(244,117,32,0.1) 0%, rgba(167,139,250,0.06) 100%)' : 'var(--bg-card)', position: 'relative' }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--brand)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 14px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 8 }}>{plan.name}</div>
              <div className="num" style={{ fontSize: 36, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>{plan.price}</div>
              <div style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 4 }}>{plan.period}</div>
              <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, marginBottom: 22 }}>
                {plan.clients === -1 ? 'Unlimited clients' : `Up to ${plan.clients} clients`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={13} color="var(--gain)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--r-sm)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', border: plan.popular ? 'none' : '1px solid var(--border)', background: plan.popular ? 'var(--brand)' : 'transparent', color: plan.popular ? '#fff' : 'var(--tx-2)', fontFamily: 'inherit', transition: 'all 150ms' }}>
                Get Started
              </button>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)', textAlign: 'center', marginTop: 8 }}>Annual plan: 2 months free</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
