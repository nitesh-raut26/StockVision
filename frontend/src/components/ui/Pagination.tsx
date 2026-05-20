import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  perPage?: number;
}

export default function Pagination({ page, totalPages, onPageChange, totalItems, perPage = 10 }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 34, height: 34, borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--tx-2)', transition: 'all 150ms',
    fontFamily: 'inherit',
  };

  const from = totalItems ? (page - 1) * perPage + 1 : undefined;
  const to = totalItems ? Math.min(page * perPage, totalItems) : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
      {totalItems !== undefined ? (
        <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
          Showing <strong style={{ color: 'var(--tx-2)' }}>{from}–{to}</strong> of{' '}
          <strong style={{ color: 'var(--tx-2)' }}>{totalItems}</strong>
        </span>
      ) : <span />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)} disabled={page === 1}
          style={{ ...btnBase, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? 'default' : 'pointer', padding: '0 8px' }}
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--tx-3)', fontSize: 13 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={{
                ...btnBase,
                background: p === page ? 'rgba(244,117,32,0.15)' : 'transparent',
                border: p === page ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)',
                color: p === page ? 'var(--brand)' : 'var(--tx-2)',
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
          style={{ ...btnBase, opacity: page === totalPages ? 0.35 : 1, cursor: page === totalPages ? 'default' : 'pointer', padding: '0 8px' }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
