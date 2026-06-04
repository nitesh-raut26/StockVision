/**
 * SystemStatus — unified live/demo data indicator.
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the scattered, hardcoded `● Live` / `● Demo` spans across the app with
 * a single component driven by a real backend health check (useBackendHealth).
 *
 *   • backend reachable  → green "● Live"
 *   • backend down       → amber "● Demo Mode" + a hover/focus tooltip that
 *                          explains why and how to enable live data
 *   • still probing      → muted "● Checking…"
 *
 * Pass `live` when the calling widget already knows it received real data for the
 * current view — it shows green immediately without waiting for the next poll.
 *
 * NOTE: every element here is inline (<span>) on purpose. These badges are placed
 * inside <p> elements on some pages, so block-level tags (<p>/<div>/<pre>) would be
 * invalid HTML descendants. We use <span> + `display` styles to stay valid anywhere.
 */
import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { useBackendHealth } from '../../hooks/useBackendHealth';

interface SystemStatusProps {
  /** Widget-level hint: it already has live backend data for this view. */
  live?: boolean;
  /** What this badge represents, e.g. "Analyst targets" — used in the tooltip. */
  subject?: string;
  /** Extra styles merged onto the inline root (e.g. marginLeft for inline use). */
  style?: CSSProperties;
}

type Resolved = 'live' | 'demo' | 'checking';

const PALETTE: Record<Resolved, { dot: string; text: string; label: string }> = {
  live:     { dot: 'var(--gain)', text: 'var(--gain)', label: 'Live' },
  demo:     { dot: 'var(--gold)', text: 'var(--gold)', label: 'Demo Mode' },
  checking: { dot: 'var(--tx-3)', text: 'var(--tx-3)', label: 'Checking…' },
};

export default function SystemStatus({ live, subject, style }: SystemStatusProps) {
  const health = useBackendHealth();
  const [open, setOpen] = useState(false);
  const tipId = useId();

  // Backend health is the source of truth. A `live` hint can only upgrade the
  // badge to green while a poll is mid-flight — it can never override a known-down
  // backend (which would be misleading).
  const resolved: Resolved =
    health.status === 'down'
      ? 'demo'
      : health.status === 'live' || live === true
        ? 'live'
        : 'checking';

  const c = PALETTE[resolved];
  const what = subject ?? 'This view';

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        role="status"
        aria-describedby={open ? tipId : undefined}
        aria-label={
          resolved === 'live'
            ? `${what}: live data, backend connected`
            : resolved === 'demo'
              ? `${what}: demo mode, backend unavailable`
              : `${what}: checking backend status`
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          color: c.text,
          cursor: 'help',
          whiteSpace: 'nowrap',
          outline: 'none',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: c.dot,
            boxShadow: resolved === 'live' ? `0 0 6px ${c.dot}` : 'none',
            flexShrink: 0,
            ...(resolved === 'live' ? { animation: 'pulse 2.2s ease-in-out infinite' } : null),
          }}
        />
        {c.label}
      </span>

      {open && (
        <span
          id={tipId}
          role="tooltip"
          style={{
            display: 'block',
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 200,
            width: 290,
            maxWidth: '78vw',
            textAlign: 'left',
            padding: 14,
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(12px)',
            cursor: 'default',
            whiteSpace: 'normal',
            fontWeight: 400,
          }}
        >
          {resolved === 'live' ? (
            <>
              <TooltipTitle dot="var(--gain)" title="Live data" />
              <span style={tipBody}>
                Connected to the StockVision backend
                {health.version ? ` (v${health.version}${health.env ? ` · ${health.env}` : ''})` : ''}.
                {' '}Analyst targets, news, market intelligence and per-ticker data are streaming live.
              </span>
            </>
          ) : resolved === 'checking' ? (
            <>
              <TooltipTitle dot="var(--tx-3)" title="Checking backend…" />
              <span style={tipBody}>
                Pinging the StockVision API to determine whether to show live or demo data.
              </span>
            </>
          ) : (
            <>
              <TooltipTitle dot="var(--gold)" title="Demo Mode" />
              <span style={tipBody}>
                Backend services are unavailable, so{' '}
                <strong style={{ color: 'var(--tx-2)', fontWeight: 700 }}>{what.toLowerCase()}</strong>{' '}
                is showing sample data.
              </span>

              <span style={tipLabel}>To enable live data</span>
              <span style={tipCode}>{`pip install -r backend/requirements.txt
python backend/run.py`}</span>

              <span style={tipLabel}>Common cause</span>
              <span style={tipCode}>ModuleNotFoundError: No module named 'jwt'</span>
              <span style={{ ...tipBody, marginTop: 4, color: 'var(--tx-3)' }}>
                PyJWT ships in <code style={tipInlineCode}>requirements.txt</code> — installing it
                resolves the missing <code style={tipInlineCode}>jwt</code> module.
              </span>

              <span style={{ ...tipBody, marginTop: 8, color: 'var(--tx-3)' }}>
                Once the backend is reachable, Analyst Targets, News, Market Intelligence and
                per-ticker data switch to Live automatically — no reload needed.
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

function TooltipTitle({ dot, title }: { dot: string; title: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.01em' }}>{title}</span>
    </span>
  );
}

const tipBody: CSSProperties = { display: 'block', fontSize: 12, lineHeight: 1.6, color: 'var(--tx-2)', margin: 0 };
const tipLabel: CSSProperties = {
  display: 'block',
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--tx-3)', marginTop: 12, marginBottom: 5,
};
const tipCode: CSSProperties = {
  display: 'block',
  margin: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface, rgba(0,0,0,0.25))',
  border: '1px solid var(--border)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--tx)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', overflowX: 'auto',
};
const tipInlineCode: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
  background: 'var(--surface-mid, rgba(255,255,255,0.06))', padding: '1px 5px', borderRadius: 5, color: 'var(--tx-2)',
};
