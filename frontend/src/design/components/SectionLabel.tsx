import { type CSSProperties, type ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function SectionLabel({ children, color, style }: SectionLabelProps) {
  return (
    <p
      className="section-label"
      style={{ color: color ?? 'var(--tx-3)', ...style }}
    >
      {children}
    </p>
  );
}

/* ── Divider with label ────────────────────────────────────────── */
export function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: '11.5px', color: 'var(--tx-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

/* ── Live dot indicator ─────────────────────────────────────────── */
interface LiveDotProps { color?: string; label?: string; }

export function LiveDot({ color = '#2db562', label = 'LIVE' }: LiveDotProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: `${color}14`, border: `1px solid ${color}35`, borderRadius: 8 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: 'pulse-dot 2s ease-in-out infinite',
        display: 'inline-block',
      }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

/* ── Metric row (label + value) ─────────────────────────────────── */
interface MetricRowProps {
  label: string;
  value: ReactNode;
  color?: string;
  mono?: boolean;
}

export function MetricRow({ label, value, color, mono }: MetricRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: '12.5px', color: 'var(--tx-3)', fontWeight: 500 }}>{label}</span>
      <span
        className={mono ? 'num' : undefined}
        style={{ fontSize: '13.5px', fontWeight: 700, color: color ?? 'var(--tx)' }}
      >
        {value}
      </span>
    </div>
  );
}
