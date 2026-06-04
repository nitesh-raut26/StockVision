/**
 * LedgerCard — surfaces the immutable trade ledger + FIFO-derived holdings.
 *
 * Self-contained: runs its own queries against /portfolio/transactions/ledger and
 * /derived-holdings (demo fallback when logged-out / backend down, badged via
 * SystemStatus). Demonstrates the auditable "holdings derived from an append-only
 * ledger" backbone.
 */
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/useStore';
import { fetchLedger, fetchDerivedHoldings } from '../../lib/api';
import SystemStatus from './SystemStatus';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function LedgerCard() {
  const { authToken } = useStore();
  const ledgerQuery = useQuery({ queryKey: ['ledger', authToken], queryFn: () => fetchLedger(authToken) });
  const derivedQuery = useQuery({ queryKey: ['derived-holdings', authToken], queryFn: () => fetchDerivedHoldings(authToken) });

  const ledger = ledgerQuery.data ?? [];
  const derived = derivedQuery.data ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Immutable Trade Ledger</h3>
          <SystemStatus live={!!authToken} subject="Trade ledger" />
        </div>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
          {ledger.length} entries · {derived.length} open positions
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 16, lineHeight: 1.5 }}>
        Holdings reconstructed FIFO from an append-only ledger — auditable &amp; tamper-evident.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {/* Derived holdings */}
        <div>
          <div style={LABEL}>Derived holdings (FIFO)</div>
          {derived.slice(0, 6).map((h) => (
            <div key={h.ticker} style={ROW}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{h.ticker}</span>
              <span className="num" style={{ fontSize: 12, color: 'var(--tx-2)' }}>{h.qty} @ {inr(h.avg_cost)}</span>
            </div>
          ))}
          {!derived.length && <div style={EMPTY}>No open positions.</div>}
        </div>

        {/* Recent ledger entries */}
        <div>
          <div style={LABEL}>Recent entries</div>
          {ledger.slice(0, 6).map((e) => (
            <div key={e.id} style={ROW}>
              <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>
                <span style={{ fontWeight: 700, color: e.action === 'BUY' ? 'var(--gain)' : 'var(--loss)' }}>{e.action}</span>{' '}
                {e.ticker}
              </span>
              <span className="num" style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{e.qty} @ {inr(e.price)} · {e.trade_date}</span>
            </div>
          ))}
          {!ledger.length && <div style={EMPTY}>No trades recorded.</div>}
        </div>
      </div>
    </motion.div>
  );
}

const LABEL = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-3)',
  textTransform: 'uppercase' as const, marginBottom: 8,
};
const ROW = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '6px 0', borderBottom: '1px solid var(--border)',
};
const EMPTY = { fontSize: 12, color: 'var(--tx-3)' };
