/**
 * ConvictionFactors — the Conviction 2.0 factor-waterfall ("show your work").
 *
 * Renders per-factor attribution bars (how many of the 10 points each factor
 * contributes), top drivers/drags, and a data-freshness note. Uses the live
 * /explain payload when available; otherwise a client-side fallback breakdown so
 * the card always renders (badged Live/Demo via SystemStatus).
 */
import SystemStatus from './SystemStatus';
import type { ConvictionExplain, ConvictionFactorRow } from '../../lib/api';

const SIGNAL_COLOR: Record<string, string> = {
  positive: 'var(--gain)',
  neutral: 'var(--tx-3)',
  negative: 'var(--loss)',
};

interface Props {
  explain: ConvictionExplain | null;
  fallbackRows: ConvictionFactorRow[];
  score: number;
}

export default function ConvictionFactors({ explain, fallbackRows, score }: Props) {
  const rows = explain?.breakdown?.length ? explain.breakdown : fallbackRows;
  const live = Boolean(explain);

  if (!rows.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Conviction Factors</h3>
        <SystemStatus live={false} subject="Conviction factors" />
      </div>
    );
  }

  const maxContribution = Math.max(...rows.map((r) => r.contribution_points), 0.01);

  const drivers =
    explain?.drivers ??
    rows.filter((r) => r.signal === 'positive').slice(0, 3)
      .map((r) => ({ label: r.label, input: r.input, contribution_points: r.contribution_points }));

  const drags =
    explain?.drags ??
    rows.filter((r) => r.signal === 'negative')
      .slice()
      .sort((a, b) => a.delta_vs_neutral - b.delta_vs_neutral)
      .slice(0, 3)
      .map((r) => ({ label: r.label, input: r.input, delta_vs_neutral: r.delta_vs_neutral }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>Conviction Factors</h3>
          <SystemStatus live={live} subject="Conviction factors" />
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--tx-3)', textTransform: 'uppercase' }}>
          {explain?.model_version ?? 'v2.0'}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginBottom: 14, lineHeight: 1.5 }}>
        How each factor contributes to the {score.toFixed(1)}/10 score — quantitative research, not advice.
      </p>

      {/* Factor bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const color = SIGNAL_COLOR[r.signal] ?? 'var(--tx-3)';
          const widthPct = Math.max(4, (r.contribution_points / maxContribution) * 100);
          return (
            <div key={r.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                  {r.input && (
                    <span style={{ fontSize: 10.5, color: 'var(--tx-3)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                      {r.input}
                    </span>
                  )}
                </span>
                <span className="num" style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                  +{r.contribution_points.toFixed(2)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-mid, rgba(255,255,255,0.05))', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${widthPct}%`, background: color, borderRadius: 3, transition: 'width 400ms ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Drivers / Drags */}
      {(drivers.length > 0 || drags.length > 0) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {drivers.length > 0 && (
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Top drivers</div>
              {drivers.map((d, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--gain)', marginBottom: 3 }}>
                  ▲ {d.label}{d.input ? ` (${d.input})` : ''}
                </div>
              ))}
            </div>
          )}
          {drags.length > 0 && (
            <div style={{ flex: 1, minWidth: 130 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Top drags</div>
              {drags.map((d, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--loss)', marginBottom: 3 }}>
                  ▼ {d.label}{d.input ? ` (${d.input})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Freshness */}
      {explain?.freshness && (
        <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 12 }}>
          Data — quote: {explain.freshness.quote.status}, fundamentals: {explain.freshness.fundamentals.status}
        </div>
      )}
    </div>
  );
}
