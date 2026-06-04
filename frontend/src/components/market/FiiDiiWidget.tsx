/**
 * FiiDiiWidget — FII/DII institutional flow chart.
 *
 * Displays daily net buy/sell flows for Foreign (FII) and
 * Domestic (DII) institutional investors — a leading sentiment
 * indicator for the Indian market.
 *
 * Data: NSE India API → cached 1 hour on backend.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Globe, Building2, Info } from 'lucide-react';
import { fetchFiiDii, fetchFiiDiiSummary, type FiiDiiRow } from '../../lib/api';
import { useStore } from '../../store/useStore';
import { useIsMobile } from '../../hooks/useBreakpoint';

type ViewMode = 'chart' | 'table';
type FiiDiiMode = 'both' | 'fii' | 'dii';

const SENTIMENT_STYLE: Record<string, { bg: string; color: string }> = {
  'Strong Buy':    { bg: 'rgba(45,181,98,0.15)',   color: '#2db562' },
  'FII Inflow':    { bg: 'rgba(34,211,238,0.12)',  color: '#22d3ee' },
  'DII Support':   { bg: 'rgba(168,85,247,0.12)',  color: '#a855f7' },
  'Mildly Bullish':{ bg: 'rgba(245,166,35,0.1)',   color: '#f5a623' },
  'Neutral':       { bg: 'rgba(124,129,150,0.1)',  color: '#7c8196' },
  'Heavy Sell':    { bg: 'rgba(229,57,53,0.12)',   color: '#e53935' },
};

function crFmt(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 10000) return `${sign}₹${(abs / 1000).toFixed(1)}k Cr`;
  return `${sign}₹${abs.toLocaleString('en-IN')} Cr`;
}

function shortDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

interface FiiDiiTooltipProps { active?: boolean; payload?: any[]; label?: string }

function FiiDiiTooltip({ active, payload, label }: FiiDiiTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-elevated)', minWidth: 160 }}>
      <p style={{ color: 'var(--tx-3)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.fill, fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: 'var(--tx)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            {crFmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FiiDiiWidget() {
  const { authToken } = useStore();
  const isMobile      = useIsMobile();
  const [view,   setView]   = useState<ViewMode>('chart');
  const [mode,   setMode]   = useState<FiiDiiMode>('both');
  const [days,   setDays]   = useState(20);
  const [showInfo, setShowInfo] = useState(false);

  const flowQuery = useQuery({
    queryKey: ['fii-dii', days, authToken],
    queryFn:  () => fetchFiiDii(days, authToken),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const summaryQuery = useQuery({
    queryKey: ['fii-dii-summary', authToken],
    queryFn:  () => fetchFiiDiiSummary(10, authToken),
    staleTime: 60 * 60 * 1000,
  });

  const rows: FiiDiiRow[] = [...(flowQuery.data?.data ?? [])].reverse(); // oldest → newest for chart
  const summary = summaryQuery.data;

  // Prepare chart data
  const chartData = rows.map(r => ({
    date:    shortDate(r.date),
    FII:     r.fii_net,
    DII:     r.dii_net,
    Total:   r.total_net,
    _raw:    r,
  }));

  const trendStyle = summary?.trend
    ? SENTIMENT_STYLE[summary.trend] ?? SENTIMENT_STYLE['Neutral']
    : SENTIMENT_STYLE['Neutral'];

  const isBullish = (summary?.fii_net_total ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card"
      style={{ padding: 22 }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            <Globe size={14} color="#22d3ee" />
            <Building2 size={14} color="#a855f7" />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', margin: 0 }}>FII / DII Activity</h3>
          {summary?.trend && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: trendStyle.bg, color: trendStyle.color }}>
              {summary.trend}
            </span>
          )}
          <button onClick={() => setShowInfo(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
            <Info size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Days selector */}
          {[10, 20, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: days === d ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: days === d ? 'var(--brand-dim)' : 'transparent', color: days === d ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit', transition: 'all 150ms' }}>
              {d}D
            </button>
          ))}
          {/* View toggle */}
          {(['chart', 'table'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: view === v ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: view === v ? 'var(--brand-dim)' : 'transparent', color: view === v ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit', transition: 'all 150ms', textTransform: 'capitalize' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      {showInfo && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.6, border: '1px solid var(--border)' }}>
          <strong style={{ color: 'var(--tx-2)' }}>FII</strong> = Foreign Institutional Investors (foreign funds, FPIs).
          <strong style={{ color: 'var(--tx-2)' }}> DII</strong> = Domestic Institutional Investors (mutual funds, insurance).
          Net positive = buying; negative = selling. Values in ₹ Crore. Data from NSE India, updated after market close.
        </div>
      )}

      {/* ── Summary tiles ────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'FII Net (10D)', value: summary.fii_net_total, icon: Globe,     color: '#22d3ee' },
            { label: 'DII Net (10D)', value: summary.dii_net_total, icon: Building2, color: '#a855f7' },
            { label: 'Combined',      value: summary.combined_net,  icon: null,       color: (summary.combined_net ?? 0) >= 0 ? '#2db562' : '#e53935' },
          ].map(tile => {
            const pos = tile.value >= 0;
            return (
              <div key={tile.label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {tile.icon && <tile.icon size={11} color={tile.color} />}
                  {tile.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: pos ? 'var(--gain)' : 'var(--loss)', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {crFmt(tile.value)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Chart view ───────────────────────────────────────── */}
      {view === 'chart' && (
        <div>
          {/* Series selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([
              { id: 'both', label: 'Both' },
              { id: 'fii',  label: 'FII' },
              { id: 'dii',  label: 'DII' },
            ] as { id: FiiDiiMode; label: string }[]).map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: mode === m.id ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: mode === m.id ? 'var(--brand-dim)' : 'transparent', color: mode === m.id ? 'var(--brand)' : 'var(--tx-3)', fontFamily: 'inherit', transition: 'all 150ms' }}>
                {m.label}
              </button>
            ))}
          </div>

          {flowQuery.isLoading ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
              Loading FII/DII data…
            </div>
          ) : (
            <div style={{ height: isMobile ? 180 : 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--tx-3)', fontSize: 9.5 }}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'var(--tx-3)', fontSize: 9.5 }}
                    axisLine={false} tickLine={false}
                    width={48}
                    tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<FiiDiiTooltip />} />
                  <ReferenceLine y={0} stroke="var(--border-md)" strokeWidth={1} />

                  {(mode === 'both' || mode === 'fii') && (
                    <Bar dataKey="FII" name="FII" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.FII >= 0 ? '#22d3ee' : '#e53935'} opacity={0.8} />
                      ))}
                    </Bar>
                  )}
                  {(mode === 'both' || mode === 'dii') && (
                    <Bar dataKey="DII" name="DII" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.DII >= 0 ? '#a855f7' : '#f97316'} opacity={0.8} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
            {(mode === 'both' || mode === 'fii') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx-3)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22d3ee', display: 'inline-block' }} />
                FII Net Buy
              </div>
            )}
            {(mode === 'both' || mode === 'dii') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx-3)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#a855f7', display: 'inline-block' }} />
                DII Net Buy
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx-3)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e53935', display: 'inline-block' }} />
              Net Sell
            </div>
          </div>
        </div>
      )}

      {/* ── Table view ───────────────────────────────────────── */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Date', 'FII Buy', 'FII Sell', 'FII Net', 'DII Buy', 'DII Sell', 'DII Net', 'Sentiment'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-md)', color: 'var(--tx-3)', fontWeight: 600, textAlign: h === 'Date' ? 'left' : 'right', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r, i) => {  // most recent first
                const sentStyle = SENTIMENT_STYLE[r.sentiment] ?? SENTIMENT_STYLE['Neutral'];
                return (
                  <tr key={r.date} style={{ background: i % 2 ? 'var(--bg-elevated)' : 'transparent' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--tx-3)', whiteSpace: 'nowrap', fontSize: 11.5 }}>{shortDate(r.date)}</td>
                    {[r.fii_buy, r.fii_sell].map((v, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--tx-2)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
                        ₹{v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: r.fii_net >= 0 ? 'var(--gain)' : 'var(--loss)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11.5 }}>
                      {crFmt(r.fii_net)}
                    </td>
                    {[r.dii_buy, r.dii_sell].map((v, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--tx-2)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
                        ₹{v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: r.dii_net >= 0 ? '#a855f7' : 'var(--loss)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11.5 }}>
                      {crFmt(r.dii_net)}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: sentStyle.bg, color: sentStyle.color, whiteSpace: 'nowrap' }}>
                        {r.sentiment}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 10, textAlign: 'right' }}>
        Source: NSE India · Updated after market close (5:30 PM IST)
      </p>
    </motion.div>
  );
}
