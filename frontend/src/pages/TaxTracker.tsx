import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertTriangle, Receipt, ArrowRight, TrendingUp, TrendingDown, Info, X, FileText } from 'lucide-react';
import { mockTaxData } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useStore } from '../store/useStore';
import { fetchTaxSummary } from '../lib/api';
import { useIsMobile } from '../hooks/useBreakpoint';

const transactions = [
  { ticker: 'HAL',    type: 'LTCG', qty: 20,  buyPrice: 3420, sellPrice: 4200, buyDate: '2024-03-12', sellDate: '2025-04-10', pnl:  15600, holding: 394 },
  { ticker: 'BEL',    type: 'STCG', qty: 500, buyPrice: 220,  sellPrice: 298,  buyDate: '2025-01-15', sellDate: '2025-08-20', pnl:  39000, holding: 217 },
  { ticker: 'TCS',    type: 'LTCG', qty: 30,  buyPrice: 3200, sellPrice: 3890, buyDate: '2023-11-08', sellDate: '2025-02-14', pnl:  20700, holding: 463 },
  { ticker: 'PAYTM',  type: 'STCG', qty: 200, buyPrice: 640,  sellPrice: 548,  buyDate: '2025-02-20', sellDate: '2025-09-18', pnl: -18400, holding: 210 },
];

const unrealizedPositions = [
  { ticker: 'RELIANCE', sector: 'Energy',   qty: 50,  avgCost: 2420, cmp: 2847, unrealizedPnl:  21350, holdingDays: 410, type: 'LTCG' },
  { ticker: 'INFY',     sector: 'IT',       qty: 100, avgCost: 1620, cmp: 1480, unrealizedPnl: -14000, holdingDays: 180, type: 'STCG' },
  { ticker: 'HDFC Bank',sector: 'Banking',  qty: 80,  avgCost: 1580, cmp: 1720, unrealizedPnl:  11200, holdingDays: 520, type: 'LTCG' },
  { ticker: 'DMART',    sector: 'FMCG',     qty: 20,  avgCost: 4800, cmp: 5100, unrealizedPnl:   6000, holdingDays: 95,  type: 'STCG' },
  { ticker: 'ZOMATO',   sector: 'Tech',     qty: 300, avgCost: 220,  cmp: 185,  unrealizedPnl: -10500, holdingDays: 140, type: 'STCG' },
];

const sectorPnl = [
  { sector: 'Defence', realized: 54600, unrealized: 21350, color: '#6366f1' },
  { sector: 'IT',      realized: 20700, unrealized: -14000, color: '#06b6d4' },
  { sector: 'Banking', realized: 0,     unrealized: 11200, color: '#f47520' },
  { sector: 'Tech',    realized: -18400, unrealized: -10500, color: '#ec4899' },
  { sector: 'FMCG',   realized: 0,      unrealized: 6000,  color: '#10b981' },
];

const chartData = [
  { month: 'Apr', stcg: 8200,  ltcg: 4100 },
  { month: 'May', stcg: 12400, ltcg: 6200 },
  { month: 'Jun', stcg: 9800,  ltcg: 3800 },
  { month: 'Jul', stcg: 15600, ltcg: 7800 },
  { month: 'Aug', stcg: 11200, ltcg: 5600 },
  { month: 'Sep', stcg: 18400, ltcg: 9200 },
  { month: 'Oct', stcg: 14800, ltcg: 7400 },
  { month: 'Nov', stcg: 9600,  ltcg: 4800 },
];

const LTCG_EXEMPTION = 125000; // ₹1.25L FY26 exemption limit

// ITR Schedule 112A data derived from transactions
const itr112aRows = [
  { isin: 'INE066A01013', name: 'HAL',    acqDate: '12/03/2024', sellDate: '10/04/2025', qty: 20,  fvc: 84000,  costAcq: 68400, gain: 15600, type: 'LTCG' },
  { isin: 'INE263A01024', name: 'BEL',    acqDate: '15/01/2025', sellDate: '20/08/2025', qty: 500, fvc: 149000, costAcq: 110000, gain: 39000, type: 'STCG' },
  { isin: 'INE467B01029', name: 'TCS',    acqDate: '08/11/2023', sellDate: '14/02/2025', qty: 30,  fvc: 116700, costAcq: 96000, gain: 20700, type: 'LTCG' },
  { isin: 'INE982J01020', name: 'PAYTM',  acqDate: '20/02/2025', sellDate: '18/09/2025', qty: 200, fvc: 109600, costAcq: 128000, gain: -18400, type: 'STCG' },
];

export default function TaxTracker() {
  const { authToken } = useStore();
  const isMobile = useIsMobile();
  const [showITR, setShowITR] = useState(false);
  const taxQuery = useQuery({
    queryKey: ['tax-summary', authToken],
    queryFn: () => fetchTaxSummary(authToken),
  });
  const tax = taxQuery.data ?? {
    stcgGains:            mockTaxData.stcgGains,
    ltcgGains:            mockTaxData.ltcgGains,
    stcgTax:              mockTaxData.stcgTax,
    ltcgTax:              mockTaxData.ltcgTax,
    totalTax:             mockTaxData.stcgTax + mockTaxData.ltcgTax,
    taxSavedPotential:    mockTaxData.taxSaved,
    harvestingSuggestions: mockTaxData.harvestingSuggestions,
  };

  const totalTax        = tax.totalTax;
  const postHarvestTax  = totalTax - tax.taxSavedPotential;
  const ltcgExemptUsed  = Math.min(tax.ltcgGains, LTCG_EXEMPTION);
  const ltcgTaxable     = Math.max(0, tax.ltcgGains - LTCG_EXEMPTION);
  const ltcgTaxActual   = Math.round(ltcgTaxable * 0.125);
  const exemptionPct    = Math.min(100, Math.round((ltcgExemptUsed / LTCG_EXEMPTION) * 100));
  const effectiveRate   = totalTax > 0 ? ((totalTax / (tax.stcgGains + tax.ltcgGains)) * 100).toFixed(1) : '0';

  const totalUnrealizedPnl = unrealizedPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Tax &amp; P&amp;L Tracker</h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>FY 2025–26 · Auto-imported from connected brokers</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowITR(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Receipt size={14} /> ITR Schedule 112A
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download size={14} /> Export CA Report
          </button>
        </div>
      </div>

      {/* Tax harvesting alert */}
      <div style={{ padding: '16px 20px', borderRadius: 'var(--r-md)', border: '1px solid rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.06)', display: 'flex', gap: 14 }}>
        <AlertTriangle size={18} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>
            Tax-Loss Harvesting Opportunity — Act Before Mar 31
          </div>
          <p style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 14, lineHeight: 1.6 }}>
            You can save <span className="num" style={{ fontWeight: 700 }}>₹{tax.taxSavedPotential.toLocaleString('en-IN')}</span> in taxes by selling these loss-making positions before financial year-end:
          </p>
          <div className="tax-harvest-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
            {tax.harvestingSuggestions.map(s => (
              <div key={s.ticker} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>{s.ticker}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{s.name}</div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--loss)', marginTop: 4 }}>
                    Loss: ₹{Math.abs(s.loss).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gain)' }}>
                    Save ₹{s.taxSaving.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Deadline: {s.deadline}</div>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 10px', borderRadius: 'var(--r-sm)', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', color: 'var(--gold)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Sell Now <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tax summary cards */}
      <div className="tax-summary-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
        {[
          { label: 'Total STCG',          value: `₹${tax.stcgGains.toLocaleString('en-IN')}`,  sub: `Tax: ₹${tax.stcgTax.toLocaleString('en-IN')} @20%`,   color: 'var(--tx)' },
          { label: 'Total LTCG',          value: `₹${tax.ltcgGains.toLocaleString('en-IN')}`,  sub: `Taxable: ₹${ltcgTaxable.toLocaleString('en-IN')} @12.5%`, color: 'var(--tx)' },
          { label: 'Total Tax Liability', value: `₹${totalTax.toLocaleString('en-IN')}`,        sub: `Effective rate: ${effectiveRate}%`,                    color: 'var(--loss)' },
          { label: 'After Tax Harvesting',value: `₹${postHarvestTax.toLocaleString('en-IN')}`,  sub: `Save ₹${tax.taxSavedPotential.toLocaleString('en-IN')}`, color: 'var(--gain)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tax Computation Worksheet + LTCG Exemption */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Tax computation */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Receipt size={14} color="var(--brand)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Tax Computation Worksheet</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Total STCG',                          value: `₹${tax.stcgGains.toLocaleString('en-IN')}`,     indent: false, bold: false, color: 'var(--tx-2)' },
              { label: 'STCG Tax @ 20%',                      value: `₹${tax.stcgTax.toLocaleString('en-IN')}`,       indent: true,  bold: false, color: 'var(--loss)' },
              { label: 'Total LTCG',                          value: `₹${tax.ltcgGains.toLocaleString('en-IN')}`,     indent: false, bold: false, color: 'var(--tx-2)' },
              { label: 'Less: Exemption (Sec 112A)',          value: `−₹${ltcgExemptUsed.toLocaleString('en-IN')}`,   indent: true,  bold: false, color: 'var(--gain)' },
              { label: 'Net Taxable LTCG',                    value: `₹${ltcgTaxable.toLocaleString('en-IN')}`,       indent: true,  bold: false, color: 'var(--tx-2)' },
              { label: 'LTCG Tax @ 12.5%',                    value: `₹${ltcgTaxActual.toLocaleString('en-IN')}`,     indent: true,  bold: false, color: 'var(--loss)' },
              { label: 'Total Tax Liability',                  value: `₹${totalTax.toLocaleString('en-IN')}`,         indent: false, bold: true,  color: 'var(--loss)' },
              { label: 'After Harvesting (Estimated)',        value: `₹${postHarvestTax.toLocaleString('en-IN')}`,    indent: false, bold: true,  color: 'var(--gain)' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 7 ? '1px solid var(--border)' : 'none', paddingLeft: row.indent ? 16 : 0 }}>
                <span style={{ fontSize: 12.5, color: 'var(--tx-3)', fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                <span className="num" style={{ fontSize: 13, fontWeight: row.bold ? 700 : 600, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* LTCG Exemption utilization */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Info size={14} color="var(--brand)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>LTCG Exemption (₹1.25L / FY)</h3>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--tx-3)', marginBottom: 16, lineHeight: 1.6 }}>
            Under Section 112A, LTCG up to ₹1,25,000 per financial year is exempt from tax. Balance: ₹{(LTCG_EXEMPTION - ltcgExemptUsed).toLocaleString('en-IN')}.
          </p>
          {/* Gauge bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Used</span>
              <span className="num" style={{ fontSize: 12, fontWeight: 700, color: exemptionPct >= 100 ? 'var(--loss)' : exemptionPct >= 80 ? 'var(--gold)' : 'var(--gain)' }}>{exemptionPct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${exemptionPct}%`, borderRadius: 5, background: exemptionPct >= 100 ? 'var(--loss)' : exemptionPct >= 80 ? 'var(--gold)' : 'var(--gain)', transition: 'width 400ms' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="num" style={{ fontSize: 11, color: 'var(--tx-3)' }}>₹{ltcgExemptUsed.toLocaleString('en-IN')} used</span>
              <span className="num" style={{ fontSize: 11, color: 'var(--tx-3)' }}>₹{LTCG_EXEMPTION.toLocaleString('en-IN')} limit</span>
            </div>
          </div>

          {/* Carry-forward losses */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 10 }}>Carry-Forward Losses (AY 2024-25)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { type: 'STCL', amount: 24600, expires: 'AY 2032-33', color: 'var(--purple)' },
                { type: 'LTCL', amount: 0,     expires: '—',          color: 'var(--tx-3)' },
              ].map(cf => (
                <div key={cf.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cf.color, padding: '2px 8px', borderRadius: 99, background: cf.amount > 0 ? `${cf.color}18` : 'transparent', border: cf.amount > 0 ? `1px solid ${cf.color}40` : 'none' }}>{cf.type}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--tx-3)', marginLeft: 10 }}>Expires: {cf.expires}</span>
                  </div>
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, color: cf.amount > 0 ? cf.color : 'var(--tx-3)' }}>
                    {cf.amount > 0 ? `−₹${cf.amount.toLocaleString('en-IN')}` : 'Nil'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly chart + Sector P&L */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>Monthly Gains Breakdown</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tx-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 10000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown, name: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, String(name).toUpperCase()]}
                />
                <Bar dataKey="stcg" name="STCG" fill="var(--purple)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ltcg" name="LTCG" fill="var(--brand)"  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[{ color: 'var(--purple)', label: 'STCG' }, { color: 'var(--brand)', label: 'LTCG' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sector P&L */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>Sector-wise P&amp;L</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={sectorPnl} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--tx-3)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                <YAxis type="category" dataKey="sector" tick={{ fill: 'var(--tx-3)', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown, name: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, name === 'realized' ? 'Realized' : 'Unrealized']}
                />
                <Bar dataKey="realized" name="realized" radius={[0, 3, 3, 0]}>
                  {sectorPnl.map((entry, i) => (
                    <Cell key={i} fill={entry.realized >= 0 ? 'var(--brand)' : 'var(--loss)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Unrealized Gains */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>Unrealized Gains / Losses</h3>
            <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>Open positions — not yet taxable</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 2 }}>Total Unrealized</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: totalUnrealizedPnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}₹{Math.abs(totalUnrealizedPnl).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th>Stock</th>
              <th>Sector</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Avg Cost</th>
              <th style={{ textAlign: 'right' }}>CMP</th>
              <th style={{ textAlign: 'right' }}>Holding</th>
              <th style={{ textAlign: 'right' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Unrealized P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {unrealizedPositions.map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: 'var(--tx)' }}>{p.ticker}</td>
                <td style={{ color: 'var(--tx-3)', fontSize: 12 }}>{p.sector}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>{p.qty}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>₹{p.avgCost.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>₹{p.cmp.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-3)' }}>{p.holdingDays}d</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: p.type === 'LTCG' ? 'var(--brand-dim)' : 'rgba(167,139,250,0.12)', color: p.type === 'LTCG' ? 'var(--brand)' : 'var(--purple)' }}>
                    {p.type}
                  </span>
                </td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: p.unrealizedPnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                  {p.unrealizedPnl >= 0 ? '+' : ''}₹{Math.abs(p.unrealizedPnl).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Realized Transactions */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Realized Capital Gains Transactions</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 520 }}>
          <thead>
            <tr>
              <th>Stock</th>
              <th style={{ textAlign: 'right' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Buy Price</th>
              <th style={{ textAlign: 'right' }}>Sell Price</th>
              <th style={{ textAlign: 'right' }}>Holding</th>
              <th style={{ textAlign: 'right' }}>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: 'var(--tx)' }}>{t.ticker}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: t.type === 'LTCG' ? 'var(--brand-dim)' : 'rgba(167,139,250,0.12)', color: t.type === 'LTCG' ? 'var(--brand)' : 'var(--purple)' }}>
                    {t.type}
                  </span>
                </td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>{t.qty}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>₹{t.buyPrice.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-2)' }}>₹{t.sellPrice.toLocaleString('en-IN')}</td>
                <td className="num" style={{ textAlign: 'right', color: 'var(--tx-3)' }}>{t.holding}d</td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: t.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                  {t.pnl >= 0 ? '+' : ''}₹{Math.abs(t.pnl).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── ITR Schedule 112A Modal ─────────────────────────── */}
      {showITR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowITR(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 860, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid var(--border-md)' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} color="var(--brand)" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>ITR Schedule 112A</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>Statement of Long/Short-Term Capital Gains — FY 2025–26 · AY 2026–27</div>
                </div>
              </div>
              <button onClick={() => setShowITR(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Notice */}
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', marginBottom: 20, fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--gold)' }}>ⓘ As per Finance Act 2024:</strong> LTCG on listed equity above ₹1,25,000 is taxable at <strong>12.5%</strong> (without indexation). STCG on listed equity is taxable at <strong>20%</strong>. Report grandfathered gains from Jan 31, 2018 CMP as cost of acquisition.
              </div>

              {/* Schedule 112A table */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 12 }}>A. Statement of Capital Gains on Sale of Equity Shares / Units (Sec 112A & 111A)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', borderRadius: 8, overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      {['Sl.', 'ISIN', 'Name of Share/Unit', 'Date of Acq.', 'Date of Transfer', 'Qty', 'Full Value (₹)', 'Cost of Acq. (₹)', 'CG / (CL) (₹)', 'Type'].map((h, i) => (
                        <th key={h} style={{ padding: '9px 10px', textAlign: i >= 5 ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', borderBottom: '2px solid var(--border-md)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itr112aRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                        <td style={{ padding: '9px 10px', color: 'var(--tx-3)' }}>{i + 1}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--tx-2)', fontFamily: 'monospace', fontSize: 11 }}>{r.isin}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--tx)' }}>{r.name}</td>
                        <td className="num" style={{ padding: '9px 10px', color: 'var(--tx-3)' }}>{r.acqDate}</td>
                        <td className="num" style={{ padding: '9px 10px', color: 'var(--tx-3)' }}>{r.sellDate}</td>
                        <td className="num" style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--tx-2)' }}>{r.qty}</td>
                        <td className="num" style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--tx)' }}>₹{r.fvc.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--tx)' }}>₹{r.costAcq.toLocaleString('en-IN')}</td>
                        <td className="num" style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: r.gain >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                          {r.gain >= 0 ? '' : '('}₹{Math.abs(r.gain).toLocaleString('en-IN')}{r.gain < 0 ? ')' : ''}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: r.type === 'LTCG' ? 'var(--brand-dim)' : 'rgba(167,139,250,0.12)', color: r.type === 'LTCG' ? 'var(--brand)' : 'var(--purple)' }}>{r.type}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-md)' }}>
                      <td colSpan={6} style={{ padding: '10px 10px', fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>Total Capital Gains</td>
                      <td className="num" style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--tx)' }}>
                        ₹{itr112aRows.reduce((s, r) => s + r.fvc, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--tx)' }}>
                        ₹{itr112aRows.reduce((s, r) => s + r.costAcq, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: 'var(--gain)' }}>
                        ₹{itr112aRows.reduce((s, r) => s + r.gain, 0).toLocaleString('en-IN')}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tax computation summary */}
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'B1. Total LTCG (Sec 112A)', value: `₹${itr112aRows.filter(r=>r.type==='LTCG').reduce((s,r)=>s+r.gain,0).toLocaleString('en-IN')}`, note: 'Before exemption' },
                  { label: 'B2. Less: Exemption u/s 112A', value: '−₹1,25,000', note: 'FY 2025–26 limit' },
                  { label: 'B3. Taxable LTCG', value: `₹${Math.max(0, itr112aRows.filter(r=>r.type==='LTCG').reduce((s,r)=>s+r.gain,0) - 125000).toLocaleString('en-IN')}`, note: 'Taxable @ 12.5%' },
                  { label: 'B4. STCG (Sec 111A)', value: `₹${itr112aRows.filter(r=>r.type==='STCG').reduce((s,r)=>s+r.gain,0).toLocaleString('en-IN')}`, note: 'Taxable @ 20%' },
                ].map(row => (
                  <div key={row.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 3 }}>{row.label}</div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{row.value}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2 }}>{row.note}</div>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={13} /> Download ITR-2 Prefill JSON
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <FileText size={13} /> Export Schedule 112A PDF
                </button>
                <button onClick={() => setShowITR(false)}
                  style={{ marginLeft: 'auto', padding: '10px 20px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
