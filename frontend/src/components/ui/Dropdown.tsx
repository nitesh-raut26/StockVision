import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface DropdownOption {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  menuMaxHeight?: number;
  searchable?: boolean;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  style,
  menuMaxHeight = 280,
  searchable = false,
  size = 'md',
  icon,
}: DropdownProps) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const containerRef          = useRef<HTMLDivElement>(null);
  const searchRef             = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* Focus search input when opened */
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 60);
    }
  }, [open, searchable]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }, []);

  const triggerPad = size === 'sm' ? '7px 11px' : '9px 14px';
  const triggerRadius = size === 'sm' ? 8 : 10;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', ...style }}
      onKeyDown={handleKeyDown}
    >
      {/* ── Trigger ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          padding: triggerPad,
          borderRadius: triggerRadius,
          border: open
            ? '1px solid var(--brand)'
            : '1px solid var(--border-md)',
          background: open
            ? 'var(--brand-dim)'
            : 'var(--bg-elevated)',
          color: selected ? 'var(--tx)' : 'var(--tx-3)',
          fontSize: size === 'sm' ? 12 : 13,
          fontWeight: selected ? 600 : 400,
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
          whiteSpace: 'nowrap',
          boxShadow: open
            ? '0 0 0 3px rgba(244,117,32,0.12)'
            : '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
          {icon && (
            <span style={{ display: 'flex', flexShrink: 0, opacity: 0.6 }}>
              {icon}
            </span>
          )}
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: selected ? 'var(--tx)' : 'var(--tx-3)',
          }}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <ChevronDown
            size={size === 'sm' ? 13 : 14}
            color={open ? 'var(--brand)' : 'var(--tx-3)'}
          />
        </motion.span>
      </button>

      {/* ── Dropdown Menu ────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 300,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-md)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Search bar */}
            {searchable && (
              <div style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-card)',
              }}>
                <Search size={13} color="var(--tx-3)" style={{ flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search…"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    color: 'var(--tx)',
                    outline: 'none',
                    padding: 0,
                    boxShadow: 'none',
                  }}
                />
              </div>
            )}

            {/* Options list */}
            <div style={{ maxHeight: menuMaxHeight, overflowY: 'auto', padding: '4px 0' }}>
              {filtered.length === 0 ? (
                <div style={{
                  padding: '14px 16px',
                  fontSize: 12.5,
                  color: 'var(--tx-3)',
                  textAlign: 'center',
                }}>
                  No results
                </div>
              ) : (
                filtered.map(opt => {
                  const isActive = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '9px 14px',
                        background: isActive ? 'var(--brand-dim)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: size === 'sm' ? 12 : 13,
                        fontWeight: isActive ? 700 : 400,
                        color: isActive ? 'var(--brand)' : 'var(--tx)',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        transition: 'background 100ms',
                        gap: 8,
                      }}
                      onMouseEnter={e => {
                        if (!isActive) (e.currentTarget).style.background = 'var(--bg-hover)';
                      }}
                      onMouseLeave={e => {
                        if (!isActive) (e.currentTarget).style.background = 'transparent';
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {opt.icon && (
                          <span style={{ display: 'flex', flexShrink: 0, opacity: isActive ? 1 : 0.55 }}>
                            {opt.icon}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                        {opt.description && !isActive && (
                          <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>
                            {opt.description}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <Check size={13} color="var(--brand)" style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
