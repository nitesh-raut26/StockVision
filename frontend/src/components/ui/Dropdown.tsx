import { useRef, useState, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  menuMaxHeight?: number;
}

export default function Dropdown({ options, value, onChange, placeholder = 'Select…', style, menuMaxHeight = 260 }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '9px 14px', borderRadius: 10,
          border: open ? '1px solid var(--brand)' : '1px solid var(--border)',
          background: open ? 'var(--brand-dim)' : 'var(--bg-card)',
          color: selected ? 'var(--tx)' : 'var(--tx-3)',
          fontSize: 13, fontWeight: selected ? 600 : 400,
          cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
          transition: 'border-color 150ms, background 150ms',
          whiteSpace: 'nowrap',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexShrink: 0 }}>
          <ChevronDown size={14} color="var(--tx-3)" />
        </motion.span>
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-md)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-elevated)',
              maxHeight: menuMaxHeight,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '6px 0',
            }}>
            {options.map(opt => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 14px',
                    background: isActive ? 'var(--brand-dim)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'var(--brand)' : 'var(--tx)',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                  <span>{opt.label}</span>
                  {isActive && <Check size={13} color="var(--brand)" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
