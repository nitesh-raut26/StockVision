import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import { useQuery } from '@tanstack/react-query';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import {
  ArrowRight, BarChart3, Brain, Shield, Globe, Users, TrendingUp,
  Check, X, Play, Zap, Star, ChevronUp, ChevronDown, Sparkles,
  Target, Lock, Sun, Moon,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis,
} from 'recharts';
import { mockMarketIndices } from '../data/mockData';
import { fetchIndices } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useBreakpoint';

/* ─── Data ─────────────────────────────────────────────────────── */
const generateSparkline = (len: number, base: number, vol = 0.018) =>
  Array.from({ length: len }, (_, i) => ({
    t: i,
    v: base * (1 + (Math.random() - 0.48) * vol * Math.sqrt(i + 1)),
  }));

const LIVE_STOCKS = [
  { ticker: 'RELIANCE', name: 'Reliance Ind',  price: 2847.35, change: +1.23, score: 8.4, data: generateSparkline(24, 2847, 0.014) },
  { ticker: 'TCS',      name: 'Tata Consult',  price: 3912.10, change: -0.38, score: 7.9, data: generateSparkline(24, 3912, 0.012) },
  { ticker: 'HDFC',     name: 'HDFC Bank',     price: 1723.60, change: +2.11, score: 9.1, data: generateSparkline(24, 1723, 0.016) },
  { ticker: 'INFY',     name: 'Infosys',       price: 1582.45, change: +0.74, score: 8.7, data: generateSparkline(24, 1582, 0.013) },
  { ticker: 'HAL',      name: 'HAL Ltd',       price: 4218.80, change: +3.42, score: 9.3, data: generateSparkline(24, 4218, 0.022) },
];

const HERO_CHART = generateSparkline(60, 100, 0.02).map((d, i) => ({ ...d, v: d.v + i * 0.3 }));

const AI_SIGNALS = [
  { ticker: 'HAL',      action: 'BUY',  conf: 94, reason: 'Defence capex surge + promoter buying',  accent: '#00C896' },
  { ticker: 'RELIANCE', action: 'HOLD', conf: 76, reason: 'Jio margins expanding, retail stable',    accent: '#F5A623' },
  { ticker: 'PAYTM',    action: 'SELL', conf: 88, reason: 'Regulatory headwinds + cash burn risk',  accent: '#FF4D6A' },
];

const FEATURES = [
  { icon: Brain,      title: 'AI Conviction Score',     desc: 'Proprietary 1–10 score from 40+ factors — ROCE trend, promoter pledging, earnings quality, sector tailwinds.',  accent: '#f47520' },
  { icon: BarChart3,  title: 'Institutional Valuation', desc: 'Full DCF model builder & Comparable Company Analysis — the same tools used by Goldman Sachs analysts.',          accent: '#22D3EE' },
  { icon: Users,      title: 'Multi-Broker Dashboard',  desc: 'Connect Zerodha, Groww, Upstox, Angel One & ICICI Direct via OAuth. One P&L across all brokers, real-time.',    accent: '#00C896' },
  { icon: Globe,      title: 'Hindi AI Summaries',      desc: "Hear a 30-second AI voice summary in Hindi — built on Bhashini — for India's 80% Hindi-speaking investors.",    accent: '#F5A623' },
  { icon: TrendingUp, title: 'Event-Driven Research',  desc: 'When a macro event fires — RBI policy, Budget, geopolitical triggers — AI generates thematic research in hours.', accent: '#A78BFA' },
  { icon: Shield,     title: 'CA White-Label Reports',  desc: "CAs generate fully branded client reports under their own firm name. B2B revenue starts at ₹5,000/month.",       accent: '#FF4D6A' },
];

const COMPETITORS = [
  { name: 'Screener.in',     ai: false, broker: false, dcf: false, tax: false, hindi: false },
  { name: 'Tickertape',      ai: false, broker: false, dcf: false, tax: false, hindi: false },
  { name: 'INDmoney',        ai: false, broker: true,  dcf: false, tax: false, hindi: false },
  { name: 'ET Money',        ai: false, broker: false, dcf: false, tax: false, hindi: false },
  { name: 'Zerodha Console', ai: false, broker: true,  dcf: false, tax: true,  hindi: false },
  { name: 'StockVision',     ai: true,  broker: true,  dcf: true,  tax: true,  hindi: true, isUs: true },
];

const TESTIMONIALS = [
  { name: 'Rohit S.',  city: 'Pune',      rating: 5, quote: 'The AI conviction score is exactly what I needed. I stopped second-guessing my picks after seeing the breakdown by fundamentals, technicals, and sentiment.' },
  { name: 'Priya M.',  city: 'Surat',     rating: 5, quote: "Hindi audio summaries changed everything. I finally understand what I'm investing in without having to translate every financial term myself." },
  { name: 'Arun K.',   city: 'Hyderabad', rating: 5, quote: 'DCF builder in 2 clicks. My CA used to charge ₹15,000 for this analysis. Now I run it myself every weekend on my shortlisted stocks.' },
  { name: 'Sneha R.',  city: 'Mumbai',    rating: 5, quote: 'The multi-broker dashboard is a game changer. No more logging into 3 apps to check my portfolio. Everything in one place, live.' },
  { name: 'Vijay T.',  city: 'Bengaluru', rating: 5, quote: 'Event-driven research is brilliant. After the RBI policy call, StockVision had a thematic note ready in 2 hours. Incredible.' },
  { name: 'Anita P.',  city: 'Delhi',     rating: 5, quote: 'As a CA I use the white-label portal to send branded reports to 40+ clients. Saves me 12 hours a week easily.' },
];

const PLANS = [
  {
    name: 'Free',       price: '₹0',     period: 'forever',  desc: 'For curious investors.',
    features: ['5 screener filters', '3 AI score checks/day', 'Manual portfolio entry', 'Basic news feed'],
    missing: ['DCF & Comps builder', 'Broker OAuth sync', 'Tax tracker'],
    cta: 'Start Free', highlight: false, badge: '',
  },
  {
    name: 'Premium',    price: '₹299',   period: '/month',   desc: 'For serious retail investors.',
    features: ['Unlimited AI conviction scores', 'All 5 broker OAuth sync', 'DCF & Comps builder', 'Tax tracker + ITR export', 'Hindi audio summaries', 'Full research library'],
    missing: ['CA white-label portal'],
    cta: 'Start 7-Day Trial', highlight: true, badge: 'Most Popular',
  },
  {
    name: 'Enterprise', price: '₹1,999', period: '/month',   desc: 'For CAs, RIAs & family offices.',
    features: ['Everything in Premium', 'CA white-label portal', 'Unlimited client reports', 'Custom PDF branding', 'API access', 'Priority support'],
    missing: [],
    cta: 'Contact Sales', highlight: false, badge: '',
  },
];

const BROKERS = ['Zerodha', 'Groww', 'Upstox', 'Angel One', 'ICICI Direct'];
const STATS = [
  { label: 'Investors on Waitlist', value: '5,284' },
  { label: 'AUM Tracked',           value: '₹1,200 Cr' },
  { label: 'Reports Generated',     value: '48,000+' },
];

/* ─── Animation variants ────────────────────────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 0.68, 0, 1.2] as [number,number,number,number] } },
};
const staggerContainer = (d = 0.1) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: d } },
});
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 0.68, 0, 1.2] as [number,number,number,number] } },
};

/* ─── Sub-components ────────────────────────────────────────────── */
function SectionReveal({ children, delay = 0, style = {}, className = '' }: {
  children: React.ReactNode; delay?: number; style?: React.CSSProperties; className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial="hidden" animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp} transition={{ delay }}>
      {children}
    </motion.div>
  );
}

function GlowDot({ color }: { color: string }) {
  return (
    <motion.span animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
  );
}

function ScoreRing({ score, accent }: { score: number; accent: string }) {
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <svg width={54} height={54} viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={27} cy={27} r={r} fill="none" stroke="var(--surface-high)" strokeWidth={4} />
      <motion.circle cx={27} cy={27} r={r} fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (score / 10) * circ }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 5px ${accent})` }} />
    </svg>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const { scrollY } = useScroll();
  const heroY       = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 420], [1, 0]);

  const indicesQuery = useQuery({ queryKey: ['landing-indices'], queryFn: fetchIndices, refetchInterval: 15000 });
  const indices = indicesQuery.data ?? mockMarketIndices;

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(p => (p + 1) % TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) { localStorage.setItem('stockvision-waitlist-email', email); setSubmitted(true); }
  };

  const colLabels = ['AI Score', 'Broker Sync', 'DCF/Comps', 'Tax Tracker', 'Hindi Audio'];
  const colKeys   = ['ai', 'broker', 'dcf', 'tax', 'hindi'] as const;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--tx)', minHeight: '100vh', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      {/* ══ TICKER TAPE ══ */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', overflow: 'hidden', height: 38 }}>
        <div className="ticker-track" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 48 }}>
          {[...indices, ...indices].map((idx, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, whiteSpace: 'nowrap', padding: '0 8px' }}>
              <span style={{ color: 'var(--tx-3)', fontWeight: 600 }}>{idx.name}</span>
              <span className="num" style={{ color: 'var(--tx)', fontWeight: 700 }}>{idx.value.toLocaleString('en-IN')}</span>
              <span className="num" style={{ color: idx.change >= 0 ? 'var(--gain)' : 'var(--loss)', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {idx.change >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {Math.abs(idx.change).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ══ NAVIGATION ══ */}
      <nav style={{
        padding: '0 clamp(20px,4vw,48px)',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Logo */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/')}>
          <img src="/apple-touch-icon.svg" alt="StockVision" style={{ width: 32, height: 32, flexShrink: 0 }} />
          {!isMobile && <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--tx)' }}>StockVision</span>}
        </motion.div>

        {/* Nav links — hidden on mobile via CSS */}
        {!isMobile && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14 }}>
            {[['Features','#features'],['Charts','#charts'],['Pricing','#pricing'],['For CAs','#forcas']].map(([label, href]) => (
              <a key={label} href={href} style={{ color: 'var(--tx-2)', textDecoration: 'none', fontWeight: 500, transition: 'color 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-2)')}>{label}</a>
            ))}
          </motion.div>
        )}

        {/* Right actions */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Theme toggle */}
          <button onClick={toggleTheme} title="Toggle theme"
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--tx-2)', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms' }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {!isMobile && <button className="btn-ghost" onClick={() => navigate('/login')} style={{ fontSize: 13.5 }}>Sign in</button>}
          <button className="btn-primary btn-glow" onClick={() => navigate('/login')} style={{ fontSize: 13, padding: isMobile ? '8px 14px' : '9px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
            Start Free {!isMobile && <ArrowRight size={13} />}
          </button>
        </motion.div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', minHeight: isMobile ? 'auto' : '92vh', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Animated bg */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div className="mesh-orb mesh-orb-1" />
          <div className="mesh-orb mesh-orb-2" />
          <div className="mesh-orb mesh-orb-3" />
          <div className="grid-dot-bg" style={{ position: 'absolute', inset: 0 }} />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', zIndex: 2, textAlign: 'center', padding: isMobile ? '48px 20px 56px' : 'clamp(80px,12vw,140px) clamp(20px,5vw,40px) 80px', maxWidth: 940, margin: '0 auto', width: '100%' }}>
          {/* Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
            style={{ marginBottom: 28, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 10px', borderRadius: 99, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', backdropFilter: 'blur(8px)' }}>
            <GlowDot color="#f47520" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', letterSpacing: '0.02em' }}>India's First AI-Powered Multi-Broker Platform</span>
          </motion.div>

          {/* H1 */}
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 0.68, 0, 1.2] as [number,number,number,number] }}
            style={{ fontSize: 'clamp(36px,7vw,78px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 24, color: 'var(--tx)' }}>
            Bloomberg Terminal.
            <br />
            <span className="gradient-text">For India. At ₹299.</span>
          </motion.h1>

          {/* Sub */}
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'var(--tx-2)', maxWidth: 620, margin: '0 auto 44px', lineHeight: 1.75 }}>
            AI conviction scores for every NSE/BSE stock, institutional DCF valuation tools, multi-broker portfolio aggregation, and Hindi audio summaries — in one platform.
          </motion.p>

          {/* CTA form */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="thanks" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.35)', borderRadius: 14, padding: '16px 28px', color: 'var(--gain)', fontWeight: 600, fontSize: 15 }}>
                  <Check size={18} /> You're on the waitlist — we'll email you soon!
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={handleWaitlist}
                  style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 8, maxWidth: 460, margin: '0 auto', background: isMobile ? 'transparent' : 'var(--surface-mid)', padding: isMobile ? '0' : '6px 6px 6px 18px', borderRadius: 16, border: isMobile ? 'none' : '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
                  <input type="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)} required
                    style={{ flex: 1, padding: isMobile ? '12px 16px' : '10px 0', background: isMobile ? 'var(--surface-mid)' : 'transparent', border: isMobile ? '1px solid var(--border)' : 'none', borderRadius: isMobile ? 12 : 0, color: 'var(--tx)', fontSize: 14, boxShadow: 'none', width: isMobile ? '100%' : undefined, boxSizing: 'border-box' }} />
                  <button type="submit" className="btn-primary btn-glow" style={{ padding: '11px 22px', fontSize: 14, flexShrink: 0, width: isMobile ? '100%' : undefined, justifyContent: 'center' }}>
                    Join Waitlist
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
            <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--tx-3)' }}>7-day free trial · No credit card required</p>
          </motion.div>

          {/* Broker chips */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.58 }}
            style={{ marginTop: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 500 }}>Connects with</span>
            {BROKERS.map(b => (
              <motion.div key={b} whileHover={{ scale: 1.07 }}
                style={{ padding: '6px 14px', background: 'var(--surface-mid)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--tx-2)', backdropFilter: 'blur(8px)' }}>
                {b}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Floating cards (desktop only) */}
        <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, duration: 0.7 }}
          className="hero-float-card" style={{ position: 'absolute', top: '22%', right: '5%', zIndex: 3 }}>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Signal — HAL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#00C896' }}>STRONG BUY</span>
            <span style={{ fontSize: 11.5, background: 'rgba(0,200,150,0.12)', color: '#00C896', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>9.3/10</span>
          </div>
          <div style={{ height: 40, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={LIVE_STOCKS[4].data}>
                <defs>
                  <linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00C896" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00C896" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#00C896" strokeWidth={2} fill="url(#hg1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85, duration: 0.7 }}
          className="hero-float-card" style={{ position: 'absolute', bottom: '20%', left: '5%', zIndex: 3 }}>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Portfolio Today</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="num" style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx)' }}>₹38.6L</span>
            <span className="num" style={{ fontSize: 13, color: '#00C896', fontWeight: 700 }}>+2.41%</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 4 }}>Live across 3 brokers</div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <div style={{ width: 24, height: 38, border: '2px solid var(--border-lg)', borderRadius: 12, display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
            <div style={{ width: 4, height: 8, background: 'var(--tx-3)', borderRadius: 2 }} />
          </div>
        </motion.div>
      </section>

      {/* ══ STATS BAR ══ */}
      <SectionReveal>
        <div style={{ padding: '0 clamp(20px,4vw,48px) 72px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            {STATS.map((s, i) => (
              <motion.div key={i} whileHover={{ background: 'var(--bg-hover)' }}
                style={{ padding: isMobile ? '20px 24px' : 'clamp(24px,4vw,40px)', textAlign: 'center', borderRight: !isMobile && i < 2 ? '1px solid var(--border)' : 'none', borderBottom: isMobile && i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div className="num" style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6, background: 'linear-gradient(135deg, var(--tx), var(--brand))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionReveal>

      {/* ══ LIVE CHARTS ══ */}
      <section id="charts" style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ marginBottom: 12, color: 'var(--brand)' }}>Live Market Intelligence</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--tx)' }}>
            Real-time data, <span className="gradient-text">AI-powered insights</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--tx-2)', marginTop: 14, maxWidth: 540, margin: '14px auto 0' }}>
            Every NSE/BSE stock tracked live with conviction scores, analyst targets, and event flags.
          </p>
        </SectionReveal>

        {/* Main chart panel */}
        <SectionReveal delay={0.1}>
          <div className="glass-card" style={{ marginBottom: 20, padding: 'clamp(20px,3vw,32px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 4, fontWeight: 600 }}>NIFTY 50 · 1D</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span className="num" style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: 'var(--tx)' }}>24,834.85</span>
                  <span className="num" style={{ fontSize: 16, color: 'var(--gain)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ChevronUp size={16} /> +1.24%
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['1D','1W','1M','3M','1Y'].map((t, i) => (
                  <button key={t} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', background: i === 0 ? 'var(--brand)' : 'transparent', color: i === 0 ? 'white' : 'var(--tx-3)', border: i === 0 ? 'none' : '1px solid var(--border)', fontFamily: 'inherit' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                <AreaChart data={HERO_CHART}>
                  <defs>
                    <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f47520" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f47520" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={['auto','auto']} hide />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 12, color: 'var(--tx)' }}
                    formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : '', '']} labelFormatter={() => ''} />
                  <Area type="monotone" dataKey="v" stroke="#f47520" strokeWidth={2.5} fill="url(#niftyGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SectionReveal>

        {/* Stock cards */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer(0.08)}
          className="landing-stock-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {LIVE_STOCKS.map(s => (
            <motion.div key={s.ticker} variants={scaleIn} whileHover={{ y: -4, boxShadow: 'var(--shadow-elevated)' }}
              className="glass-card" style={{ padding: 18, cursor: 'pointer', transition: 'box-shadow 250ms,transform 250ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx)' }}>{s.ticker}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 1 }}>{s.name}</div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.score > 8 ? 'rgba(0,200,150,0.12)' : s.score > 6 ? 'rgba(245,166,35,0.12)' : 'rgba(255,77,106,0.12)',
                  fontSize: 10.5, fontWeight: 800,
                  color: s.score > 8 ? 'var(--gain)' : s.score > 6 ? 'var(--gold)' : 'var(--loss)' }}>
                  {s.score}
                </div>
              </div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--tx)' }}>₹{s.price.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>
              <div className="num" style={{ fontSize: 11.5, color: s.change >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 10 }}>
                {s.change >= 0 ? <ChevronUp size={11} /> : <ChevronDown size={11} />}{Math.abs(s.change).toFixed(2)}%
              </div>
              <div style={{ height: 36 }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                  <LineChart data={s.data}>
                    <Line type="monotone" dataKey="v" stroke={s.change >= 0 ? '#00C896' : '#FF4D6A'} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══ AI BENTO ══ */}
      <section style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ marginBottom: 12, color: 'var(--purple)' }}>AI Intelligence Engine</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--tx)' }}>
            Signals that <span style={{ color: 'var(--purple)' }}>think ahead</span>
          </h2>
        </SectionReveal>

        <div className="landing-bento-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* AI Signals */}
          <SectionReveal delay={0.05}>
            <div className="glass-card bento-glow-purple" style={{ padding: 32, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={18} color="var(--purple)" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>AI Trading Signals</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>Updated every market close</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.25)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: 'var(--gain)' }}>
                  <GlowDot color="#00C896" /> LIVE
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {AI_SIGNALS.map((sig, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 + 0.2 }}
                    whileHover={{ x: 4 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: 'var(--surface-low)', border: '1px solid var(--surface-border)', cursor: 'pointer', transition: 'all 200ms' }}>
                    <ScoreRing score={sig.conf / 10} accent={sig.accent} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx)' }}>{sig.ticker}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: `${sig.accent}18`, color: sig.accent, border: `1px solid ${sig.accent}33` }}>{sig.action}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{sig.reason}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontSize: 20, fontWeight: 800, color: sig.accent }}>{sig.conf}%</div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>confidence</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </SectionReveal>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <SectionReveal delay={0.1}>
              <div className="glass-card bento-glow-blue" style={{ padding: 28 }}>
                <div style={{ fontSize: 13, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 18 }}>MARKET SENTIMENT TODAY</div>
                <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                  {[...Array(10)].map((_, i) => (
                    <motion.div key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.4, ease: 'backOut' }}
                      style={{ flex: 1, height: 40, borderRadius: 5, transformOrigin: 'bottom', background: i < 7 ? `rgba(0,200,150,${0.2 + i * 0.08})` : `rgba(255,77,106,${0.3 + (i-7)*0.15})` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 600 }}>
                  <span style={{ color: 'var(--loss)' }}>BEARISH</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gain)' }}>Bullish (7/10)</span>
                  <span style={{ color: 'var(--gain)' }}>BULLISH</span>
                </div>
              </div>
            </SectionReveal>

            <SectionReveal delay={0.15}>
              <div className="glass-card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <Target size={16} color="var(--gold)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>AI Top Picks Today</span>
                </div>
                {[['HAL','9.3','+3.4%','var(--gain)'],['HDFC BANK','9.1','+2.1%','var(--gain)'],['INFY','8.7','+0.7%','var(--brand)']].map(([t,s,c,col],i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{t}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>Score: {s}/10</div>
                    </div>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: col }}>{c}</span>
                  </div>
                ))}
              </div>
            </SectionReveal>
          </div>
        </div>

        {/* Bottom row */}
        <div className="landing-bottom-bento" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>
          {[
            { icon: Zap,      color: 'var(--gold)',   title: 'Event Alerts',        sub: 'RBI policy + Budget themes auto-generated', stat: '48h',    statLabel: 'avg research turnaround' },
            { icon: Lock,     color: 'var(--cyan)',   title: 'Bank-Grade Security', sub: 'OAuth-only broker connect. We never store credentials.', stat: '256-bit', statLabel: 'AES encryption' },
            { icon: Sparkles, color: 'var(--purple)', title: 'Hindi AI Summaries',  sub: 'Bhashini-powered 30-second audio for every stock', stat: '5,000+', statLabel: 'stocks covered' },
          ].map((b, i) => (
            <SectionReveal key={i} delay={i * 0.08}>
              <motion.div whileHover={{ y: -4 }} className="glass-card" style={{ padding: 28, cursor: 'default', transition: 'all 250ms' }}>
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 300 }}
                  style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, border: '1px solid var(--border)' }}>
                  <b.icon size={20} color={b.color} />
                </motion.div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--tx)' }}>{b.title}</div>
                <div style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 20, lineHeight: 1.65 }}>{b.sub}</div>
                <div className="num" style={{ fontSize: 28, fontWeight: 800, color: b.color, letterSpacing: '-0.02em' }}>{b.stat}</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{b.statLabel}</div>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="section-label" style={{ marginBottom: 12, color: 'var(--cyan)' }}>Platform Capabilities</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--tx)' }}>
            Everything institutional.<br /><span className="gradient-text-cyan">Priced for retail.</span>
          </h2>
        </SectionReveal>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={staggerContainer(0.09)}
          className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <motion.div key={i} variants={scaleIn} whileHover={{ y: -6, boxShadow: 'var(--shadow-elevated)' }}
              className="glass-card" style={{ padding: 30, cursor: 'default', transition: 'all 280ms cubic-bezier(.22,.68,0,1.2)' }}>
              <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 300 }}
                style={{ width: 48, height: 48, background: 'var(--surface-mid)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, border: '1px solid var(--border)' }}>
                <f.icon size={22} color={f.accent} />
              </motion.div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--tx)' }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.72 }}>{f.desc}</div>
              <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: f.accent, fontWeight: 600 }}>
                Learn more <ArrowRight size={12} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══ COMPARISON TABLE ══ */}
      <section style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Competitive Landscape</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--tx)' }}>
            Every platform is missing something.<br />StockVision fills the gap.
          </h2>
        </SectionReveal>
        <SectionReveal delay={0.1}>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 540 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 24px', textAlign: 'left' }}>Platform</th>
                    {colLabels.map(l => <th key={l} style={{ textAlign: 'center', padding: '14px 18px' }}>{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {COMPETITORS.map((c, i) => (
                    <motion.tr key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                      style={{ background: c.isUs ? 'var(--brand-dim)' : 'transparent' }}>
                      <td style={{ padding: '16px 24px', fontWeight: c.isUs ? 800 : 500, color: c.isUs ? 'var(--brand)' : 'var(--tx-2)' }}>
                        {c.isUs && <span style={{ marginRight: 8, fontSize: 10, background: 'var(--brand)', color: 'white', padding: '2px 7px', borderRadius: 5, fontWeight: 700, letterSpacing: '0.05em' }}>YOU</span>}
                        {c.name}
                      </td>
                      {colKeys.map(k => (
                        <td key={k} style={{ textAlign: 'center', padding: '16px 18px' }}>
                          {c[k] ? <Check size={16} color="var(--gain)" strokeWidth={2.5} /> : <X size={16} color="var(--tx-3)" strokeWidth={2} />}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionReveal>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="section-label" style={{ marginBottom: 12, color: 'var(--gain)' }}>Simple Pricing</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--tx)' }}>Start free. Scale when you're ready.</h2>
          <p style={{ fontSize: 16, color: 'var(--tx-2)', marginTop: 14 }}>Annual plan saves 2 months. Cancel anytime.</p>
        </SectionReveal>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer(0.1)}
          className="landing-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, alignItems: 'start' }}>
          {PLANS.map((plan, i) => (
            <motion.div key={i} variants={scaleIn}
              onMouseEnter={() => setHoveredPlan(i)}
              onMouseLeave={() => setHoveredPlan(null)}
              animate={{
                y: hoveredPlan === i ? -8 : 0,
                boxShadow: plan.highlight
                  ? hoveredPlan === i ? '0 24px 60px rgba(244,117,32,0.25),0 0 0 1px rgba(244,117,32,0.5)' : '0 8px 30px rgba(244,117,32,0.15),0 0 0 1px rgba(244,117,32,0.35)'
                  : hoveredPlan === i ? 'var(--shadow-elevated)' : 'var(--shadow-card)',
              }}
              style={{
                padding: 36, borderRadius: 'var(--r-xl)', position: 'relative', cursor: 'default',
                background: plan.highlight ? 'var(--bg-card)' : 'var(--bg-card)',
                border: `1px solid ${plan.highlight ? 'rgba(244,117,32,0.45)' : 'var(--border)'}`,
                transition: 'box-shadow 300ms',
              }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#f47520,#f5a623)', color: 'white', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(244,117,32,0.4)' }}>
                  <Star size={12} fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{plan.badge}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span className="num" style={{ fontSize: 'clamp(32px,5vw,44px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--tx)' }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: 'var(--tx-3)' }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--tx-2)', marginBottom: 28, lineHeight: 1.5 }}>{plan.desc}</div>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/login')}
                className={plan.highlight ? 'btn-primary btn-glow' : 'btn-ghost'}
                style={{ width: '100%', justifyContent: 'center', padding: '13px', marginBottom: 28, fontSize: 14, fontFamily: 'inherit' }}>
                {plan.cta} <ArrowRight size={14} />
              </motion.button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--tx-2)' }}>
                    <Check size={14} color="var(--gain)" style={{ flexShrink: 0, marginTop: 3 }} /> {f}
                  </div>
                ))}
                {plan.missing.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--tx-3)' }}>
                    <X size={14} color="var(--tx-3)" style={{ flexShrink: 0, marginTop: 3 }} /> {f}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="section-label" style={{ marginBottom: 12, color: 'var(--gold)' }}>Early Users</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--tx)' }}>Trusted by serious investors</h2>
        </SectionReveal>

        <SectionReveal delay={0.05}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTestimonial} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45 }}
              className="glass-card" style={{ padding: 'clamp(28px,5vw,56px)', marginBottom: 28, textAlign: 'center', border: '1px solid var(--border-brand)' }}>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 20 }}>
                {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={18} fill="var(--gold)" color="var(--gold)" />)}
              </div>
              <p style={{ fontSize: 'clamp(15px,2vw,20px)', color: 'var(--tx)', lineHeight: 1.72, maxWidth: 680, margin: '0 auto 32px', fontStyle: 'italic', fontWeight: 500 }}>
                "{TESTIMONIALS[activeTestimonial].quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#f47520,#f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                  {TESTIMONIALS[activeTestimonial].name[0]}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tx)' }}>{TESTIMONIALS[activeTestimonial].name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{TESTIMONIALS[activeTestimonial].city}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {TESTIMONIALS.map((_, i) => (
              <motion.button key={i} onClick={() => setActiveTestimonial(i)}
                animate={{ width: i === activeTestimonial ? 28 : 8, background: i === activeTestimonial ? 'var(--brand)' : 'var(--border-lg)' }}
                style={{ height: 8, borderRadius: 99, border: 'none', cursor: 'pointer' }} />
            ))}
          </div>
        </SectionReveal>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer(0.08)}
          className="landing-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 28 }}>
          {TESTIMONIALS.slice(0, 3).map((t, i) => (
            <motion.div key={i} variants={scaleIn} whileHover={{ y: -4 }} className="glass-card" style={{ padding: 28, cursor: 'default', transition: 'transform 250ms' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                {Array.from({ length: t.rating }).map((_, j) => <Star key={j} size={13} fill="var(--gold)" color="var(--gold)" />)}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.75, marginBottom: 22 }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>
                  {t.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{t.city}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══ VIDEO DEMO ══ */}
      <section style={{ padding: '0 clamp(20px,4vw,48px) 100px', maxWidth: 1200, margin: '0 auto' }}>
        <SectionReveal>
          <motion.div whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 200 }}
            className="glass-card"
            style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-brand)', padding: 'clamp(32px,5vw,60px) clamp(24px,5vw,64px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,var(--brand-glow) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 14 }}>Platform Demo</div>
              <h3 style={{ fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em', color: 'var(--tx)' }}>Watch the platform in action</h3>
              <p style={{ fontSize: 15, color: 'var(--tx-2)', maxWidth: 480, lineHeight: 1.7 }}>
                See how a real investor runs the AI conviction screen, builds a DCF model, and generates a CA-ready tax report — all in under 8 minutes.
              </p>
            </div>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 32px rgba(244,117,32,0.35)', margin: isMobile ? '0 auto' : undefined }}>
              <Play size={24} fill="#f47520" color="#f47520" style={{ marginLeft: 4 }} />
            </motion.button>
          </motion.div>
        </SectionReveal>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section id="forcas" style={{ padding: '0 clamp(20px,4vw,48px) 120px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <SectionReveal>
          <div className="glass-card" style={{ position: 'relative', padding: 'clamp(48px,8vw,80px) clamp(24px,6vw,64px)', border: '1px solid var(--border-brand)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,var(--brand-dim) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,var(--brand-dim) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '6px 16px', background: 'rgba(0,200,150,0.10)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 99 }}>
                <GlowDot color="#00C896" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gain)', letterSpacing: '0.04em' }}>7-DAY FREE TRIAL · NO CARD REQUIRED</span>
              </div>
              <h2 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, letterSpacing: '-0.035em', marginBottom: 16, lineHeight: 1.1, color: 'var(--tx)' }}>Start your free trial today</h2>
              <p style={{ fontSize: 17, color: 'var(--tx-2)', marginBottom: 44, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 44px' }}>
                Full Premium access from day one. No credit card. Cancel anytime.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn-primary btn-glow" style={{ fontSize: 16, padding: '15px 32px', fontFamily: 'inherit' }} onClick={() => navigate('/login')}>
                  Get Started Free <ArrowRight size={16} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn-ghost" style={{ fontSize: 16, padding: '15px 32px', fontFamily: 'inherit' }} onClick={() => navigate('/login')}>
                  Sign In
                </motion.button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 36, flexWrap: 'wrap' }}>
                {['No credit card','Cancel anytime','Full Premium access'].map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--tx-3)' }}>
                    <Check size={13} color="var(--gain)" /> {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionReveal>
      </section>

      <Footer />
    </div>
  );
}
