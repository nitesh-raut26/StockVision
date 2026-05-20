import { type ReactNode, type CSSProperties } from 'react';

type BadgeVariant = 'gain' | 'loss' | 'brand' | 'gold' | 'purple' | 'cyan' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string }> = {
  gain:    { bg: 'rgba(45,181,98,0.12)',   color: 'var(--gain)'   },
  loss:    { bg: 'rgba(229,57,53,0.12)',    color: 'var(--loss)'   },
  brand:   { bg: 'var(--brand-dim)',        color: 'var(--brand)'  },
  gold:    { bg: 'rgba(245,166,35,0.12)',   color: 'var(--gold)'   },
  purple:  { bg: 'rgba(167,139,250,0.12)',  color: 'var(--purple)' },
  cyan:    { bg: 'rgba(34,211,238,0.12)',   color: 'var(--cyan)'   },
  neutral: { bg: 'var(--surface-mid)',      color: 'var(--tx-3)'   },
};

const sizeMap = {
  xs: { fontSize: '10px',   padding: '2px 6px',  gap: '4px'  },
  sm: { fontSize: '11px',   padding: '3px 8px',  gap: '5px'  },
  md: { fontSize: '11.5px', padding: '4px 10px', gap: '5px'  },
};

export function Badge({ variant = 'neutral', size = 'sm', children, dot = false, style }: BadgeProps) {
  const v = variantMap[variant];
  const s = sizeMap[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      padding: s.padding,
      fontSize: s.fontSize,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      borderRadius: 99,
      background: v.bg,
      color: v.color,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}

/* ── Score badge with number ────────────────────────────────────── */
interface ScoreBadgeProps { score: number; size?: 'sm' | 'md' | 'lg'; }

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const color = score >= 8 ? 'var(--gain)' : score >= 6 ? 'var(--gold)' : 'var(--loss)';
  const bg    = score >= 8 ? 'rgba(45,181,98,0.12)' : score >= 6 ? 'rgba(245,166,35,0.12)' : 'rgba(229,57,53,0.12)';
  const label = score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low';
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '15px' : '13px';
  const scoreFontSize = size === 'sm' ? '13px' : size === 'lg' ? '22px' : '17px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: size === 'lg' ? '10px 14px' : '6px 10px', borderRadius: 10, background: bg, border: `1px solid ${color}22` }}>
      <span className="num" style={{ fontSize: scoreFontSize, fontWeight: 800, color, lineHeight: 1 }}>
        {score.toFixed(1)}
      </span>
      <span style={{ fontSize, fontWeight: 600, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

/* ── Broker tag ─────────────────────────────────────────────────── */
export function BrokerTag({ name }: { name: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      padding: '3px 8px',
      background: 'var(--brand-dim)',
      color: 'var(--brand)',
      borderRadius: 6,
    }}>
      {name}
    </span>
  );
}
