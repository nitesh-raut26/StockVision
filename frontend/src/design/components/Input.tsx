import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

/* ── Text Input ─────────────────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const inputSizeMap = {
  sm: { padding: '7px 12px',   fontSize: '13px', height: '32px' },
  md: { padding: '10px 14px',  fontSize: '14px', height: '40px' },
  lg: { padding: '12px 16px',  fontSize: '15px', height: '46px' },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, leftIcon, rightElement, inputSize = 'md', style, ...rest
}, ref) => {
  const s = inputSizeMap[inputSize];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', letterSpacing: '0.02em' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {leftIcon && (
          <span style={{ position: 'absolute', left: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          style={{
            width: '100%',
            height: s.height,
            padding: s.padding,
            paddingLeft: leftIcon ? '36px' : s.padding,
            paddingRight: rightElement ? '40px' : s.padding,
            fontSize: s.fontSize,
            background: 'var(--bg-input)',
            border: `1px solid ${error ? 'var(--loss)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            color: 'var(--tx)',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
            ...style,
          }}
          {...rest}
        />
        {rightElement && (
          <span style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center' }}>
            {rightElement}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: '11.5px', color: 'var(--loss)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: '11.5px', color: 'var(--tx-3)' }}>{hint}</span>}
    </div>
  );
});
Input.displayName = 'Input';

/* ── Select ─────────────────────────────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, inputSize = 'md', style, children, ...rest
}, ref) => {
  const s = inputSizeMap[inputSize];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', letterSpacing: '0.02em' }}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        style={{
          width: '100%',
          height: s.height,
          padding: s.padding,
          fontSize: s.fontSize,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--tx)',
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
});
Select.displayName = 'Select';
