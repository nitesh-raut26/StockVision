/**
 * Design tokens — CSS variable references as typed constants.
 * Use these instead of raw strings so refactoring is safe.
 */

export const color = {
  bg:          'var(--bg)',
  bgSurface:   'var(--bg-surface)',
  bgCard:      'var(--bg-card)',
  bgElevated:  'var(--bg-elevated)',
  bgHover:     'var(--bg-hover)',
  bgInput:     'var(--bg-input)',

  border:      'var(--border)',
  borderMd:    'var(--border-md)',
  borderLg:    'var(--border-lg)',
  borderBrand: 'var(--border-brand)',

  brand:       'var(--brand)',
  brandHover:  'var(--brand-hover)',
  brandDim:    'var(--brand-dim)',
  brandGlow:   'var(--brand-glow)',

  tx:          'var(--tx)',
  tx2:         'var(--tx-2)',
  tx3:         'var(--tx-3)',

  gain:        'var(--gain)',
  loss:        'var(--loss)',
  gold:        'var(--gold)',
  purple:      'var(--purple)',
  cyan:        'var(--cyan)',

  surfaceLow:  'var(--surface-low)',
  surfaceMid:  'var(--surface-mid)',
  surfaceHigh: 'var(--surface-high)',
} as const;

export const shadow = {
  card:     'var(--shadow-card)',
  elevated: 'var(--shadow-elevated)',
  brand:    'var(--shadow-brand)',
} as const;

export const radius = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
} as const;

export const font = {
  base: "'Inter', system-ui, -apple-system, sans-serif",
  size: {
    xs:   '11px',
    sm:   '12px',
    base: '13.5px',
    md:   '14px',
    lg:   '15px',
    xl:   '16px',
    '2xl':'18px',
    '3xl':'22px',
    '4xl':'28px',
    '5xl':'36px',
    hero: 'clamp(36px,5vw,52px)',
  },
  weight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
    black:     900,
  },
} as const;

export const spacing = {
  0:  '0',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;
