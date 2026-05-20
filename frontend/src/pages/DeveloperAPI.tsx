import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '../hooks/useBreakpoint';
import {
  Zap, Shield, BarChart3, Brain, TrendingUp, Layers, Target,
  ArrowRight, Check, Copy, ChevronDown, ChevronUp,
  Globe, Clock, Activity, Key, BookOpen, Users, Rocket,
} from 'lucide-react';

/* ── Dark-always palette (same as Footer) ─────────────────────── */
const D = {
  bg:       '#09090b',
  surface:  '#0f1017',
  card:     '#14151f',
  border:   '#1e2130',
  tx:       '#f1f2f6',
  tx2:      '#8a8fa8',
  tx3:      '#42475a',
  brand:    '#f47520',
  green:    '#2db562',
  purple:   '#a78bfa',
  blue:     '#38bdf8',
};

/* ── API Products ─────────────────────────────────────────────── */
const API_PRODUCTS = [
  {
    icon: Brain,
    color: D.brand,
    name: 'AI Conviction Score',
    tag: 'Most Popular',
    tagColor: D.brand,
    desc: 'Proprietary 1–10 score computed from 40+ factors: ROCE trend, promoter pledging, earnings quality, sector tailwinds, institutional flows.',
    endpoint: 'GET /v1/conviction/{ticker}',
    latency: '~120ms',
    sample: `{
  "ticker": "RELIANCE",
  "score": 8.4,
  "signal": "BUY",
  "confidence": 0.87,
  "factors": {
    "earnings_quality": 8.9,
    "promoter_holding": 7.2,
    "momentum": 9.1,
    "valuation": 6.8
  },
  "updated_at": "2026-05-19T09:15:00Z"
}`,
  },
  {
    icon: BarChart3,
    color: D.blue,
    name: 'Market Data',
    tag: 'Real-time',
    tagColor: D.blue,
    desc: 'Live and historical OHLCV data for 5,000+ NSE/BSE stocks, 40 indices, F&O instruments. 15-min delayed on Starter, real-time on Growth+.',
    endpoint: 'GET /v1/quote/{ticker}',
    latency: '~40ms',
    sample: `{
  "ticker": "RELIANCE",
  "ltp": 2847.35,
  "open": 2812.00,
  "high": 2861.40,
  "low": 2808.75,
  "volume": 4218503,
  "change": 35.35,
  "change_pct": 1.26,
  "52w_high": 3024.90,
  "52w_low": 2220.30,
  "market_cap": 19284500000000
}`,
  },
  {
    icon: Target,
    color: '#22d3ee',
    name: 'Stock Screener',
    tag: 'Fundamental',
    tagColor: '#22d3ee',
    desc: 'Run custom screener queries on the full NSE universe. Filter by PE, ROCE, debt/equity, promoter holding, revenue growth, market cap, and more.',
    endpoint: 'POST /v1/screener/run',
    latency: '~380ms',
    sample: `// Request body
{
  "filters": {
    "min_roce": 15,
    "max_pe": 25,
    "min_market_cap": 5000,
    "sector": "Banking"
  },
  "sort_by": "conviction_score",
  "limit": 20
}
// Returns array of matching stocks with scores`,
  },
  {
    icon: TrendingUp,
    color: D.green,
    name: 'DCF Valuation',
    tag: 'Premium',
    tagColor: '#a78bfa',
    desc: 'Full Discounted Cash Flow model for any NSE stock. Returns intrinsic value, upside/downside, WACC, terminal growth assumptions, and scenario analysis.',
    endpoint: 'GET /v1/dcf/{ticker}',
    latency: '~220ms',
    sample: `{
  "ticker": "TCS",
  "intrinsic_value": 4280.50,
  "current_price": 3912.10,
  "upside_pct": 9.4,
  "wacc": 0.1124,
  "terminal_growth": 0.045,
  "scenarios": {
    "bear": 3410.00,
    "base": 4280.50,
    "bull": 5120.00
  }
}`,
  },
  {
    icon: Layers,
    color: '#f43f5e',
    name: 'Options Chain',
    tag: 'Derivatives',
    tagColor: '#f43f5e',
    desc: 'Full NSE options chain with Greeks (Delta, Gamma, Theta, Vega), IV surface, PCR, max pain, support/resistance strikes for any F&O stock.',
    endpoint: 'GET /v1/options/{ticker}/{expiry}',
    latency: '~90ms',
    sample: `{
  "ticker": "NIFTY",
  "expiry": "2026-05-29",
  "spot": 24842.65,
  "pcr": 1.24,
  "max_pain": 24800,
  "chain": [
    {
      "strike": 24800,
      "call_ltp": 312.40,
      "call_iv": 14.8,
      "call_delta": 0.54,
      "put_ltp": 275.10,
      "put_iv": 15.2
    }
  ]
}`,
  },
  {
    icon: Activity,
    color: '#fb923c',
    name: 'Portfolio Analytics',
    tag: 'Wealth-Tech',
    tagColor: '#fb923c',
    desc: 'XIRR, absolute returns, sector allocation, P&L breakdown, tax liability (STCG/LTCG), and benchmark comparison for any portfolio you pass.',
    endpoint: 'POST /v1/portfolio/analyse',
    latency: '~280ms',
    sample: `// Request: array of trades
{
  "holdings": [
    { "ticker": "RELIANCE", "qty": 50,
      "avg_cost": 2480, "buy_date": "2024-01-10" }
  ]
}
// Returns
{
  "xirr": 22.4,
  "abs_return_pct": 14.8,
  "invested": 1240000,
  "current_value": 1423500,
  "stcg_liability": 0,
  "ltcg_liability": 18350
}`,
  },
];

/* ── Pricing plans ────────────────────────────────────────────── */
const PLANS = [
  {
    name: 'Starter',
    price: '₹2,999',
    period: '/month',
    calls: '10,000 calls/mo',
    rateLimit: '10 req/sec',
    latency: '15-min delayed data',
    color: D.tx2,
    features: [
      'All API endpoints',
      '10,000 API calls/month',
      '10 requests/second',
      '15-minute delayed market data',
      'Community support',
      'Sandbox environment',
    ],
    popular: false,
  },
  {
    name: 'Growth',
    price: '₹9,999',
    period: '/month',
    calls: '100,000 calls/mo',
    rateLimit: '50 req/sec',
    latency: 'Real-time data',
    color: D.brand,
    features: [
      'Everything in Starter',
      '100,000 API calls/month',
      '50 requests/second',
      'Real-time market data',
      'WebSocket streams',
      'Email support (24h SLA)',
      'Historical data (10 years)',
    ],
    popular: true,
  },
  {
    name: 'Scale',
    price: '₹29,999',
    period: '/month',
    calls: '1M calls/mo',
    rateLimit: '200 req/sec',
    latency: 'Real-time + co-lo',
    color: D.purple,
    features: [
      'Everything in Growth',
      '1,000,000 API calls/month',
      '200 requests/second',
      'Co-location data feed option',
      'Dedicated Slack channel',
      '4h SLA for incidents',
      'Custom data integrations',
      'White-label rights',
    ],
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    calls: 'Unlimited',
    rateLimit: 'Unlimited',
    latency: 'Direct feed',
    color: '#22d3ee',
    features: [
      'Unlimited API calls',
      'Direct NSE data feed',
      'On-premise deployment option',
      'Custom SLA (99.99% uptime)',
      'Dedicated account manager',
      'Custom model training',
      'Source code licence available',
    ],
    popular: false,
  },
];

/* ── Code examples ─────────────────────────────────────────────── */
const CODE_TABS = ['cURL', 'JavaScript', 'Python', 'Go'] as const;
type CodeTab = typeof CODE_TABS[number];

const CODE_EXAMPLES: Record<CodeTab, string> = {
  cURL: `curl -X GET "https://api.stockvision.in/v1/conviction/RELIANCE" \\
  -H "Authorization: Bearer sv_live_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json"`,

  JavaScript: `import StockVision from '@stockvision/node';

const sv = new StockVision('sv_live_xxxxxxxxxxxxxxxx');

// Get AI Conviction Score
const score = await sv.conviction.get('RELIANCE');
console.log(score.score);      // 8.4
console.log(score.signal);     // "BUY"

// Run a screener
const results = await sv.screener.run({
  filters: { min_roce: 15, max_pe: 25 },
  sort_by: 'conviction_score',
  limit: 10,
});`,

  Python: `import stockvision

sv = stockvision.Client(api_key="sv_live_xxxxxxxxxxxxxxxx")

# Get AI Conviction Score
score = sv.conviction.get("RELIANCE")
print(score.score)      # 8.4
print(score.signal)     # "BUY"

# Real-time quote
quote = sv.market.quote("TCS")
print(f"₹{quote.ltp} ({quote.change_pct:+.2f}%)")

# DCF Valuation
dcf = sv.dcf.get("INFY")
print(f"Intrinsic: ₹{dcf.intrinsic_value}")
print(f"Upside: {dcf.upside_pct:.1f}%")`,

  Go: `package main

import (
  "fmt"
  sv "github.com/stockvision/go-sdk"
)

func main() {
  client := sv.NewClient("sv_live_xxxxxxxxxxxxxxxx")

  // Get AI Conviction Score
  score, _ := client.Conviction.Get("RELIANCE")
  fmt.Printf("Score: %.1f | Signal: %s\\n",
    score.Score, score.Signal)

  // Stream real-time quotes
  stream, _ := client.Market.Stream([]string{
    "RELIANCE", "TCS", "HDFC",
  })
  for quote := range stream.Quotes() {
    fmt.Printf("%s: ₹%.2f\\n", quote.Ticker, quote.LTP)
  }
}`,
};

/* ── FAQs ──────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'How do I get an API key?', a: 'Sign up for a StockVision developer account, choose a plan, and your API key is generated instantly. You can create multiple keys per project and rotate them at any time from the dashboard.' },
  { q: 'Is the data NSE/BSE licensed?', a: 'Yes. StockVision has licensed data agreements with NSE and BSE. All data distributed via our API complies with exchange licensing terms. Enterprise customers receive sub-licensing rights for their end users.' },
  { q: 'What is the uptime SLA?', a: 'Growth and Scale plans have a 99.9% uptime SLA (≤8.7 hours downtime/year). Enterprise plans offer a 99.99% SLA with credit compensation for breaches.' },
  { q: 'Can I use the API in a commercial product?', a: 'Yes. Growth tier and above includes commercial use rights. Starter is for development and testing only. Enterprise includes white-label rights for embedding StockVision data in your branded product.' },
  { q: 'What rate limits apply?', a: 'Limits are per API key per second: Starter 10 req/s, Growth 50 req/s, Scale 200 req/s. WebSocket connections allow you to stream unlimited events without counting against HTTP rate limits on Growth+.' },
  { q: 'Do you offer a sandbox / test environment?', a: 'All plans include a full sandbox with simulated data that mirrors the production API schema. Use `sv_test_` keys to develop and test without consuming production call quotas.' },
];

/* ─────────────────────────────────────────────────────────────── */

export default function DeveloperAPI() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('JavaScript');
  const [copiedCode, setCopiedCode] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState(0);

  const copyCode = async () => {
    await navigator.clipboard.writeText(CODE_EXAMPLES[activeCodeTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div style={{ background: D.bg, color: D.tx, fontFamily: 'inherit', minHeight: '100dvh' }}>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 90,
        background: `${D.bg}e8`, backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
            {/* Logo */}
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, background: D.brand, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="9.5" width="3" height="5" rx="0.8" fill="white" />
                  <rect x="6.5" y="6" width="3" height="8.5" rx="0.8" fill="white" />
                  <rect x="11.5" y="1.5" width="3" height="13" rx="0.8" fill="white" />
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: D.tx, letterSpacing: '-0.02em' }}>StockVision</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: D.brand, background: 'rgba(244,117,32,0.15)', padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em' }}>API</span>
            </button>
            {!isMobile && (
              <div style={{ display: 'flex', gap: 20 }}>
                {['Docs', 'Reference', 'SDKs', 'Status'].map(item => (
                  <a key={item} href="#" style={{ fontSize: 13.5, color: D.tx2, textDecoration: 'none' }}>{item}</a>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!isMobile && (
              <button onClick={() => navigate('/login')} style={{ padding: '8px 18px', background: 'transparent', border: `1px solid ${D.border}`, color: D.tx2, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign in
              </button>
            )}
            <button onClick={() => navigate('/login')} style={{ padding: '8px 16px', background: D.brand, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={13} />
              {isMobile ? 'Get Key' : 'Get API Key'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,10vw,120px) 24px clamp(40px,6vw,80px)', textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', background: 'rgba(244,117,32,0.12)', border: `1px solid rgba(244,117,32,0.3)`, borderRadius: 99, fontSize: 12, fontWeight: 700, color: D.brand, letterSpacing: '0.06em', marginBottom: 24, textTransform: 'uppercase' }}>
            <Rocket size={11} />
            B2B Financial Data API
          </div>

          <h1 style={{ fontSize: 'clamp(36px,7vw,72px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: 24, background: `linear-gradient(135deg, ${D.tx} 40%, ${D.tx2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            India's most powerful<br />
            <span style={{ WebkitTextFillColor: D.brand }}>financial data API</span>
          </h1>

          <p style={{ fontSize: 'clamp(15px,2.5vw,19px)', color: D.tx2, lineHeight: 1.7, maxWidth: 640, margin: '0 auto 40px' }}>
            AI conviction scores, real-time market data, DCF valuations, options chains, and portfolio analytics — everything you need to build the next great Indian fintech product.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '14px 28px', background: D.brand, border: 'none', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
              Start for free <ArrowRight size={15} />
            </button>
            <a href="#docs" style={{ padding: '14px 28px', background: 'transparent', border: `1px solid ${D.border}`, color: D.tx2, borderRadius: 10, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={15} />
              View docs
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}`, background: D.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? '16px 12px' : 20 }}>
          {[
            { icon: Globe,    val: '5,000+',  label: 'NSE/BSE stocks'     },
            { icon: Clock,    val: '40ms',    label: 'Avg API latency'    },
            { icon: Activity, val: '99.9%',   label: 'Uptime SLA'         },
            { icon: Zap,      val: '200 req/s',label: 'Max rate limit'    },
            { icon: Shield,   val: 'TLS 1.3', label: 'Encrypted transport'},
            { icon: Users,    val: '300+',    label: 'B2B customers'      },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <Icon size={18} color={D.brand} />
              <div style={{ fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: '-0.02em' }}>{val}</div>
              <div style={{ fontSize: 11.5, color: D.tx3, letterSpacing: '0.02em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── API PRODUCTS ────────────────────────────────────────── */}
      <section id="docs" style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,96px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: D.brand, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>API Products</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx, marginBottom: 14 }}>
            Six APIs. One subscription.
          </h2>
          <p style={{ fontSize: 16, color: D.tx2, maxWidth: 520, margin: '0 auto' }}>
            All APIs share the same base URL, authentication, and response format. One integration, six superpowers.
          </p>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
          {API_PRODUCTS.map((p, i) => (
            <button key={i} onClick={() => setActiveProduct(i)} style={{
              padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${activeProduct === i ? p.color + '60' : D.border}`,
              background: activeProduct === i ? `${p.color}18` : 'transparent',
              color: activeProduct === i ? p.color : D.tx2,
              transition: 'all 150ms',
            }}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Active product detail */}
        <AnimatePresence mode="wait">
          {API_PRODUCTS.map((p, i) => activeProduct === i && (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
              style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden' }}>

              {/* Left: description */}
              <div style={{ padding: '36px 36px 36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${p.color}18`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <p.icon size={20} color={p.color} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: D.tx }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${p.tagColor}18`, color: p.tagColor, border: `1px solid ${p.tagColor}30` }}>{p.tag}</span>
                    </div>
                    <code style={{ fontSize: 12, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>{p.endpoint}</code>
                  </div>
                </div>

                <p style={{ fontSize: 14, color: D.tx2, lineHeight: 1.75, marginBottom: 22 }}>{p.desc}</p>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ padding: '10px 16px', background: D.surface, borderRadius: 8, border: `1px solid ${D.border}` }}>
                    <div style={{ fontSize: 10.5, color: D.tx3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Latency</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: D.green }}>{p.latency}</div>
                  </div>
                  <div style={{ padding: '10px 16px', background: D.surface, borderRadius: 8, border: `1px solid ${D.border}` }}>
                    <div style={{ fontSize: 10.5, color: D.tx3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coverage</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: D.blue }}>NSE + BSE</div>
                  </div>
                </div>
              </div>

              {/* Right: sample response */}
              <div style={{ background: '#0d0f1a', borderLeft: isMobile ? 'none' : `1px solid ${D.border}`, borderTop: isMobile ? `1px solid ${D.border}` : 'none', position: 'relative' }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                  </div>
                  <span style={{ fontSize: 11.5, color: D.tx3, marginLeft: 4 }}>Response · 200 OK</span>
                </div>
                <pre style={{
                  padding: '20px 22px', margin: 0, fontSize: 12,
                  color: '#a8b3d1', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: 1.8, overflowX: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {p.sample.split('\n').map((line, j) => {
                    const key = line.match(/"([^"]+)":/)?.[1];
                    const val = line.match(/:\s*(.+)/)?.[1];
                    if (!key) return <span key={j}>{line}<br /></span>;
                    return (
                      <span key={j}>
                        <span style={{ color: '#7dd3fc' }}>  "{key}"</span>
                        <span style={{ color: '#a8b3d1' }}>: </span>
                        <span style={{ color: typeof val === 'string' && val.startsWith('"') ? '#86efac' : '#fbbf24' }}>{val}</span>
                        <br />
                      </span>
                    );
                  })}
                </pre>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      {/* ── CODE QUICKSTART ─────────────────────────────────────── */}
      <section style={{ background: D.surface, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,96px) 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: isMobile ? 36 : 56, alignItems: 'start' }}>

            {/* Left */}
            <div>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: D.brand, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Quick Start</p>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx, marginBottom: 16 }}>
                First API call in 60 seconds
              </h2>
              <p style={{ fontSize: 15, color: D.tx2, lineHeight: 1.75, marginBottom: 28 }}>
                Consistent RESTful JSON API across all six products. Same authentication, same error codes, same pagination — learn once, use everywhere.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { step: '01', title: 'Get your API key', desc: 'Create a free account and copy your key from the dashboard.' },
                  { step: '02', title: 'Make your first request', desc: 'Pass the key as a Bearer token in the Authorization header.' },
                  { step: '03', title: 'Go live', desc: 'Swap sv_test_ for sv_live_ and start serving real data to your users.' },
                ].map(s => (
                  <div key={s.step} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(244,117,32,0.15)', border: '1px solid rgba(244,117,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: D.brand, fontFamily: "'JetBrains Mono', monospace" }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 3 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: D.tx2 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: code block */}
            <div style={{ background: '#0d0f1a', borderRadius: 14, border: `1px solid ${D.border}`, overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, background: '#0a0c14' }}>
                {CODE_TABS.map(tab => (
                  <button key={tab} onClick={() => setActiveCodeTab(tab)} style={{
                    padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: 600,
                    color: activeCodeTab === tab ? D.brand : D.tx3,
                    borderBottom: activeCodeTab === tab ? `2px solid ${D.brand}` : '2px solid transparent',
                    transition: 'all 150ms',
                  }}>
                    {tab}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={copyCode} style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: copiedCode ? D.green : D.tx3, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <Copy size={12} />
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <pre style={{ padding: '22px 24px', margin: 0, fontSize: 12.5, color: '#a8b3d1', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.85, overflowX: 'auto', whiteSpace: 'pre' }}>
                <AnimatePresence mode="wait">
                  <motion.span key={activeCodeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    {CODE_EXAMPLES[activeCodeTab]}
                  </motion.span>
                </AnimatePresence>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,96px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: D.brand, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx, marginBottom: 14 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: 16, color: D.tx2, maxWidth: 460, margin: '0 auto' }}>
            Start free with 1,000 sandbox calls. No credit card required until you go live.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: plan.popular ? `linear-gradient(160deg, ${D.card}, #1a1225)` : D.card,
              border: `1px solid ${plan.popular ? 'rgba(244,117,32,0.5)' : D.border}`,
              borderRadius: 14, padding: '28px 24px',
              position: 'relative', overflow: 'hidden',
            }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 800, color: '#fff', background: D.brand, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.06em' }}>POPULAR</div>
              )}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: plan.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: plan.price === 'Custom' ? 28 : 32, fontWeight: 900, color: D.tx, letterSpacing: '-0.03em' }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 13, color: D.tx2 }}>{plan.period}</span>}
                </div>
                <div style={{ fontSize: 12, color: D.tx3, marginTop: 6 }}>{plan.calls} · {plan.rateLimit}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: D.tx2 }}>
                    <Check size={13} color={D.green} style={{ flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>

              <button onClick={() => navigate('/login')} style={{
                width: '100%', padding: '11px', borderRadius: 9, fontFamily: 'inherit',
                fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                background: plan.popular ? D.brand : 'transparent',
                border: `1px solid ${plan.popular ? D.brand : D.border}`,
                color: plan.popular ? '#fff' : D.tx2,
              }}>
                {plan.price === 'Custom' ? 'Contact sales' : 'Get started'}
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: D.tx3 }}>
          All plans include a free sandbox with 1,000 test calls. Annual billing saves 20%.
        </p>
      </section>

      {/* ── USE CASES ───────────────────────────────────────────── */}
      <section style={{ background: D.surface, borderTop: `1px solid ${D.border}`, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,8vw,80px) 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: D.brand, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Who Uses Our API</p>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx }}>Built for every fintech use case</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
            {[
              { icon: '🤖', title: 'Robo-Advisors',         desc: 'Power AI stock selection with conviction scores and screener APIs. Run portfolio rebalancing at scale.' },
              { icon: '📱', title: 'Investment Apps',        desc: 'Embed real-time quotes, AI research, and DCF models into your consumer investment app.' },
              { icon: '🏦', title: 'Wealth Management',      desc: 'Give advisors institutional-grade tools: portfolio analytics, tax reports, client dashboards.' },
              { icon: '📊', title: 'Research Platforms',     desc: 'Distribute AI conviction scores and DCF valuations to institutional and retail subscribers.' },
              { icon: '⚡', title: 'Algo Trading',            desc: 'Feed systematic strategies with conviction scores, momentum signals, and options flow data.' },
              { icon: '🎓', title: 'Fintech Education',       desc: 'Give students real market data and valuation tools for courses, simulations, and competitions.' },
            ].map(u => (
              <div key={u.title} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{u.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 6 }}>{u.title}</div>
                <div style={{ fontSize: 13, color: D.tx2, lineHeight: 1.7 }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px,8vw,96px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx }}>Frequently asked questions</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: D.tx }}>{faq.q}</span>
                {openFaq === i ? <ChevronUp size={16} color={D.tx3} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color={D.tx3} style={{ flexShrink: 0 }} />}
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '0 22px 18px', fontSize: 14, color: D.tx2, lineHeight: 1.75, borderTop: `1px solid ${D.border}`, paddingTop: 14 }}>
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section style={{ background: D.surface, borderTop: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: 'clamp(60px,10vw,100px) 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, letterSpacing: '-0.03em', color: D.tx, marginBottom: 16 }}>
            Ready to build?
          </h2>
          <p style={{ fontSize: 16, color: D.tx2, marginBottom: 36, lineHeight: 1.7 }}>
            Start with 1,000 free sandbox calls. No credit card required. Production keys available in minutes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/login')} style={{ padding: '14px 32px', background: D.brand, border: 'none', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={15} />
              Get API Key — Free
            </button>
            <a href="mailto:api@stockvision.in" style={{ padding: '14px 28px', background: 'transparent', border: `1px solid ${D.border}`, color: D.tx2, borderRadius: 10, fontSize: 15, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* ── BOTTOM BAR ──────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${D.border}`, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: D.bg }}>
        <span style={{ fontSize: 12, color: D.tx3 }}>© 2026 StockVision Technologies Pvt. Ltd. · SEBI RA: INH000000000</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Status', 'Changelog', 'Support', 'Terms'].map(link => (
            <a key={link} href="#" style={{ fontSize: 12, color: D.tx3, textDecoration: 'none' }}>{link}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
