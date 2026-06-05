/**
 * PublicStock — public, no-auth SEO page for a single stock's AI conviction.
 *
 * The viral/SEO funnel: shareable, indexable, and capped by a sign-up CTA. Reuses
 * the same ConvictionFactors waterfall as the in-app StockDetail. Renders sample
 * data (badged) when the backend is unavailable.
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchStockDetails,
  fetchConvictionExplain,
  buildFactorWaterfall,
  demoConvictionFactors,
} from '../lib/api';
import ConvictionBadge from '../components/ui/ConvictionBadge';
import ConvictionFactors from '../components/ui/ConvictionFactors';
import Footer from '../components/layout/Footer';

export default function PublicStock() {
  const { ticker = 'HAL' } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const t = ticker.toUpperCase();

  const detailQuery = useQuery({ queryKey: ['public-stock', t], queryFn: () => fetchStockDetails(t) });
  const explainQuery = useQuery({ queryKey: ['public-conviction-explain', t], queryFn: () => fetchConvictionExplain(t) });

  const stock = detailQuery.data?.stock;
  const score = stock?.convictionScore ?? 5;
  const risk = stock?.risk ?? 'Medium';
  const fallbackRows = buildFactorWaterfall(detailQuery.data?.conviction?.factors ?? demoConvictionFactors(score));

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--tx)', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* React 19 hoists these into <head> for SEO/social previews */}
      <title>{`${t} AI Conviction Score ${score}/10 | StockVision`}</title>
      <meta
        name="description"
        content={`StockVision's AI rates ${t} a ${score}/10 conviction (${risk} risk). See the factor-by-factor breakdown — valuation, growth, momentum and more.`}
      />

      {/* Nav */}
      <nav style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(20px,4vw,48px)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/apple-touch-icon.svg" alt="StockVision" style={{ width: 30, height: 30 }} />
          <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--tx)' }}>StockVision</span>
        </Link>
        <button className="btn-primary btn-glow" onClick={() => navigate('/signup')} style={{ fontSize: 13, padding: '9px 18px' }}>
          Start Free
        </button>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(28px,5vw,56px) clamp(20px,4vw,32px) 64px' }}>
        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
          <ConvictionBadge score={score} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(26px,5vw,40px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, color: 'var(--tx)' }}>{t}</h1>
            <p style={{ fontSize: 14, color: 'var(--tx-2)', margin: '4px 0 0' }}>{stock?.name ?? t} · {stock?.sector ?? '—'}</p>
          </div>
        </div>
        <p style={{ fontSize: 15, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 28 }}>
          StockVision&apos;s AI rates <strong style={{ color: 'var(--tx)' }}>{t}</strong> a{' '}
          <strong style={{ color: 'var(--brand)' }}>{score}/10</strong> conviction ({risk} risk) — here&apos;s exactly why, factor by factor.
        </p>

        {/* Factor waterfall (same component as in-app) */}
        <div className="glass-card" style={{ padding: 22, marginBottom: 24 }}>
          <ConvictionFactors explain={explainQuery.data ?? null} fallbackRows={fallbackRows} score={score} />
        </div>

        {/* Sign-up CTA */}
        <div className="glass-card" style={{ padding: 28, textAlign: 'center', border: '1px solid var(--border-brand)', background: 'var(--brand-dim)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--tx)' }}>See the full picture on {t}</h2>
          <p style={{ fontSize: 14, color: 'var(--tx-2)', marginBottom: 18, lineHeight: 1.6 }}>
            DCF valuation, multi-broker portfolio, tax intelligence and price alerts — the Bloomberg Terminal for India, at ₹299/month.
          </p>
          <button className="btn-primary btn-glow" onClick={() => navigate('/signup')} style={{ fontSize: 14, padding: '12px 28px' }}>
            Start free — no card required
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 20, textAlign: 'center' }}>
          Quantitative research signal, not investment advice.{explainQuery.data ? '' : ' Showing sample data.'}
        </p>
      </main>
      <Footer />
    </div>
  );
}
