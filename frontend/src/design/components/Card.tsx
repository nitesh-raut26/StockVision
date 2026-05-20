import { forwardRef, type HTMLAttributes, type ReactNode, type CSSProperties } from 'react';

type CardVariant = 'default' | 'elevated' | 'glass' | 'surface' | 'brand';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CSSProperties['padding'];
  children: ReactNode;
}

const variantStyles: Record<CardVariant, CSSProperties> = {
  default: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  },
  elevated: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-md)',
    boxShadow: 'var(--shadow-elevated)',
  },
  glass: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  },
  surface: {
    background: 'var(--surface-low)',
    border: '1px solid var(--surface-border)',
    boxShadow: 'none',
  },
  brand: {
    background: 'var(--brand-dim)',
    border: '1px solid var(--border-brand)',
    boxShadow: 'none',
  },
};

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'default',
  padding = '22px',
  children,
  style,
  ...rest
}, ref) => (
  <div
    ref={ref}
    style={{
      borderRadius: 'var(--r-lg)',
      padding,
      ...variantStyles[variant],
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
));
Card.displayName = 'Card';

/* ── Stat card ────────────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  accent?: string;
}

export function StatCard({ label, value, sub, trend, icon, accent }: StatCardProps) {
  const trendColor = trend === 'up' ? 'var(--gain)' : trend === 'down' ? 'var(--loss)' : 'var(--tx-3)';

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: accent ? `${accent}15` : 'var(--surface-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
        )}
      </div>
      <div className="num" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: trendColor, fontWeight: 600 }}>{sub}</div>
      )}
    </Card>
  );
}
