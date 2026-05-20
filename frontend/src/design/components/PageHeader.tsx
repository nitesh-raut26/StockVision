import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, onAction, actionIcon, badge }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 4 : 0, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', margin: 0 }}>
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p style={{ fontSize: '12.5px', color: 'var(--tx-3)', lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '13px', fontWeight: 600, color: 'var(--brand)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, flexShrink: 0,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {action}
          {actionIcon ?? <ArrowRight size={13} />}
        </button>
      )}
    </div>
  );
}

/* ── Full page title header ────────────────────────────────────── */
interface FullPageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  label?: string;
  labelColor?: string;
  actions?: ReactNode;
}

export function FullPageHeader({ title, subtitle, label, labelColor, actions }: FullPageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
      <div>
        {label && (
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor ?? 'var(--brand)', marginBottom: 8 }}>
            {label}
          </p>
        )}
        <h1 style={{ fontSize: 'clamp(22px,4vw,28px)', fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '14px', color: 'var(--tx-3)', marginTop: 6, lineHeight: 1.6 }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
