import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type Variant = 'primary' | 'ghost' | 'outline' | 'brand-ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
  children: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeMap: Record<Size, { padding: string; fontSize: string; gap: string; height: string }> = {
  sm: { padding: '6px 14px',  fontSize: '12.5px', gap: '5px',  height: '32px' },
  md: { padding: '9px 18px',  fontSize: '14px',   gap: '7px',  height: '38px' },
  lg: { padding: '12px 26px', fontSize: '15px',   gap: '8px',  height: '46px' },
};

const variantMap: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--brand)',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--tx-2)',
    border: '1px solid var(--border-md)',
    fontWeight: 500,
  },
  outline: {
    background: 'transparent',
    color: 'var(--brand)',
    border: '1px solid var(--border-brand)',
    fontWeight: 600,
  },
  'brand-ghost': {
    background: 'var(--brand-dim)',
    color: 'var(--brand)',
    border: '1px solid var(--border-brand)',
    fontWeight: 600,
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  glow = false,
  children,
  loading = false,
  fullWidth = false,
  style,
  disabled,
  ...rest
}, ref) => {
  const s = sizeMap[size];
  const v = variantMap[variant];

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        height: s.height,
        fontSize: s.fontSize,
        fontFamily: 'inherit',
        borderRadius: 'var(--r-md)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        transition: 'background 150ms, box-shadow 200ms, transform 80ms, border-color 150ms, color 150ms',
        width: fullWidth ? '100%' : undefined,
        ...v,
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : null}
      {children}
    </button>
  );
});
Button.displayName = 'Button';

/* ── Motion-enhanced button for Landing / hero areas ── */
export function AnimButton({
  variant = 'primary',
  size = 'md',
  glow = false,
  children,
  fullWidth = false,
  style,
  ...rest
}: ButtonProps & Omit<HTMLMotionProps<'button'>, keyof ButtonProps>) {
  const s = sizeMap[size];
  const v = variantMap[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.03, ...(glow && variant === 'primary' ? {
        boxShadow: '0 0 24px rgba(244,117,32,0.5), 0 4px 16px rgba(244,117,32,0.35)'
      } : {}) }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: 'inherit',
        fontWeight: 600,
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        width: fullWidth ? '100%' : undefined,
        ...v,
        ...style,
      }}
      {...(rest as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
}
