import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Pagination from '../components/ui/Pagination';

const PER_PAGE = 10;
import {
  TrendingUp, TrendingDown, Calendar, Zap, Star,
  ChevronUp, ChevronDown, AlertCircle, ArrowRight, Shield,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useBreakpoint';

type Tab = 'upcoming' | 'open' | 'listed' | 'sme' | 'elss';

/* ── Mock Data ──────────────────────────────────────────────────── */
const UPCOMING_IPOS = [
  { company: 'IndiGrid InvIT', sector: 'Infrastructure', exchange: 'NSE/BSE', opens: 'Jun 03, 2026', closes: 'Jun 05, 2026', price: '₹102–108', size: '₹3,200 Cr', gmp: '+₹14', gmpPct: 13.0,  subscription: null, rating: 4, type: 'Mainboard', logo: '⚡' },
  { company: 'BoAt Lifestyle', sector: 'Consumer Elec', exchange: 'NSE/BSE', opens: 'Jun 09, 2026', closes: 'Jun 11, 2026', price: '₹480–510', size: '₹2,000 Cr', gmp: '+₹62', gmpPct: 12.2, subscription: null, rating: 5, type: 'Mainboard', logo: '🎧' },
  { company: 'Ola Electric 2',sector: 'EV',            exchange: 'NSE/BSE', opens: 'Jun 16, 2026', closes: 'Jun 18, 2026', price: '₹74–76',   size: '₹1,750 Cr', gmp: '+₹8',  gmpPct: 10.5, subscription: null, rating: 3, type: 'Mainboard', logo: '🛵' },
  { company: 'Zepto',          sector: 'Q-Commerce',   exchange: 'BSE SME', opens: 'Jun 23, 2026', closes: 'Jun 25, 2026', price: '₹220–228', size: '₹600 Cr',   gmp: '+₹40', gmpPct: 17.5, subscription: null, rating: 4, type: 'SME',       logo: '🛒' },
];

const OPEN_IPOS = [
  { company: 'NTPC Green Energy', sector: 'Renewable', exchange: 'NSE/BSE', opens: 'May 20, 2026', closes: 'May 22, 2026', price: '₹108–114', size: '₹10,000 Cr', gmp: '+₹22', gmpPct: 19.3, subscription: 4.82, rating: 5, type: 'Mainboard', logo: '☀️', subBreakup: { qib: 8.42, nii: 3.14, retail: 2.18 } },
  { company: 'Indira IVF',        sector: 'Healthcare', exchange: 'NSE/BSE', opens: 'May 19, 2026', closes: 'May 21, 2026', price: '₹392–414', size: '₹800 Cr',   gmp: '+₹55', gmpPct: 13.3, subscription: 2.14, rating: 4, type: 'Mainboard', logo: '🏥', subBreakup: { qib: 4.18, nii: 1.62, retail: 1.04 } },
];

const LISTED_IPOS = [
  { company: 'Hyundai India',     sector: 'Auto',     exchange: 'NSE/BSE', listDate: 'May 14, 2026', issuePrice: 1960, cmp: 2248, gain: 14.7,   gmp: null, type: 'Mainboard', logo: '🚗' },
  { company: 'Swiggy',            sector: 'FoodTech', exchange: 'NSE/BSE', listDate: 'May 10, 2026', issuePrice: 390,  cmp: 428,  gain: 9.7,    gmp: null, type: 'Mainboard', logo: '🍱' },
  { company: 'Sagility India',    sector: 'IT-BPO',  exchange: 'NSE/BSE', listDate: 'May 06, 2026', issuePrice: 30,   cmp: 27.4, gain: -8.7,   gmp: null, type: 'Mainboard', logo: '💻' },
  { company: 'Bajaj Housing Fin', sector: 'NBFC',    exchange: 'NSE/BSE', listDate: 'Apr 29, 2026', issuePrice: 70,   cmp: 116,  gain: 65.7,   gmp: null, type: 'Mainboard', logo: '🏠' },
  { company: 'NTPC Green',        sector: 'Energy',  exchange: 'NSE/BSE', listDate: 'Apr 22, 2026', issuePrice: 108,  cmp: 142,  gain: 31.5,   gmp: null, type: 'Mainboard', logo: '⚡' },
  { company: 'Premier Energies',  sector: 'Solar',   exchange: 'NSE/BSE', listDate: 'Apr 18, 2026', issuePrice: 427,  cmp: 892,  gain: 108.9,  gmp: null, type: 'Mainboard', logo: '☀️' },
];

const SME_IPOS = [
  { company: 'MedPlus Health',  sector: 'Pharma Retail',  exchange: 'BSE SME', opens: 'Jun 02, 2026', price: '₹218–228', size: '₹24 Cr',   gmp: '+₹32', gmpPct: 14.0, subscription: 38.4, rating: 4, logo: '💊' },
  { company: 'VNR Infracon',    sector: 'Infrastructure', exchange: 'NSE Emerge', opens: 'Jun 04, 2026', price: '₹42–44',   size: '₹15 Cr',   gmp: '+₹8',  gmpPct: 18.2, subscription: 142.8, rating: 3, logo: '🏗️' },
  { company: 'ATC Energies',    sector: 'Solar EPC',      exchange: 'BSE SME', opens: 'Jun 07, 2026', price: '₹128–136', size: '₹32 Cr',   gmp: '+₹22', gmpPct: 16.2, subscription: 64.2, rating: 4, logo: '☀️' },
  { company: 'GoGreen Farms',   sector: 'Agri-Tech',      exchange: 'NSE Emerge', opens: 'Jun 11, 2026', price: '₹88–92',   size: '₹18 Cr',   gmp: '+₹12', gmpPct: 13.0, subscription: 21.6, rating: 3, logo: '🌾' },
];

const ELSS_FUNDS = [
  { name: 'Quant ELSS Tax Saver',          amc: 'Quant',    nav: 342.84, returns1y: 48.2, returns3y: 30.4, returns5y: 28.1, lockIn: 3, expenseRatio: 0.57, fundManager: 'Ankit Pande',     rating: 5, minSIP: 500  },
  { name: 'Parag Parikh ELSS Tax Saver',   amc: 'PPFAS',    nav: 36.18,  returns1y: 26.8, returns3y: 22.8, returns5y: 20.4, lockIn: 3, expenseRatio: 0.58, fundManager: 'Rajeev Thakkar',   rating: 5, minSIP: 500  },
  { name: 'Mirae Asset ELSS Tax Saver',    amc: 'Mirae',    nav: 44.62,  returns1y: 29.4, returns3y: 24.1, returns5y: 21.8, lockIn: 3, expenseRatio: 0.47, fundManager: 'Neelesh Surana',   rating: 5, minSIP: 500  },
  { name: 'Axis ELSS Tax Saver',           amc: 'Axis',     nav: 82.44,  returns1y: 18.4, returns3y: 14.2, returns5y: 16.8, lockIn: 3, expenseRatio: 0.55, fundManager: 'Jinesh Gopani',    rating: 3, minSIP: 500  },
  { name: 'SBI Magnum ELSS',               amc: 'SBI MF',   nav: 360.14, returns1y: 22.8, returns3y: 20.4, returns5y: 19.2, lockIn: 3, expenseRatio: 0.91, fundManager: 'Dinesh Balachandran', rating: 4, minSIP: 500 },
  { name: 'DSP ELSS Tax Saver',            amc: 'DSP',      nav: 108.42, returns1y: 24.2, returns3y: 21.8, returns5y: 20.1, lockIn: 3, expenseRatio: 0.82, fundManager: 'Rohit Singhania',  rating: 4, minSIP: 500  },
];

/* ── Helpers ────────────────────────────────────────────────────── */
const cardV = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 0.68, 0, 1.2] as [number, number, number, number] } }),
};

function StarRating({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} fill={i < n ? 'var(--gold)' : 'none'} color={i < n ? 'var(--gold)' : 'var(--border-lg)'} />
      ))}
    </div>
  );
}

function SubBar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, width: 38 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: 'var(--surface-high)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (val / 20) * 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color, minWidth: 32 }}>{val.toFixed(1)}x</span>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */
const CONNECTED_BROKERS = [
  { id: 'zerodha',   name: 'Zerodha',   color: '#387ED1', initials: 'Ze', note: 'ASBA via Zerodha Console' },
  { id: 'groww',     name: 'Groww',     color: '#00D09C', initials: 'Gr', note: 'Apply directly in Groww app' },
  { id: 'angelone',  name: 'Angel One', color: '#F04E23', initials: 'An', note: 'Apply via Angel One SmartAPI' },
];

export default function IPOTracker() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('open');
  const [listedPage, setListedPage] = useState(1);
  const listedTotalPages = Math.ceil(LISTED_IPOS.length / PER_PAGE);
  const listedRows = LISTED_IPOS.slice((listedPage - 1) * PER_PAGE, listedPage * PER_PAGE);
  const [applyModal, setApplyModal] = useState<{ company: string; price: string } | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const handleApplyBroker = (brokerName: string) => {
    setApplySuccess(brokerName);
    setTimeout(() => { setApplyModal(null); setApplySuccess(null); }, 2200);
  };

  return (
    <div style={{ maxWidth: 1400, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', marginBottom: 4 }}>IPO Tracker</h1>
            <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>Mainboard · SME/Emerge · ELSS · GMP · Subscription Status</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Open Now',   value: OPEN_IPOS.length,    color: 'var(--gain)' },
              { label: 'Upcoming',   value: UPCOMING_IPOS.length, color: 'var(--gold)' },
              { label: 'SME Active', value: SME_IPOS.length,     color: 'var(--purple)' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                <div className="num" style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {([
            ['open',     'Open Now 🔴'],
            ['upcoming', 'Upcoming'],
            ['listed',   'Recently Listed'],
            ['sme',      'SME / Emerge'],
            ['elss',     'ELSS Funds'],
          ] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: tab === v ? '2px solid var(--brand)' : '2px solid transparent', color: tab === v ? 'var(--brand)' : 'var(--tx-3)', marginBottom: -1, fontFamily: 'inherit', transition: 'all 150ms', whiteSpace: 'nowrap' }}>
              {l}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══ OPEN IPOs ══ */}
        {tab === 'open' && (
          <motion.div key="open" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {OPEN_IPOS.map((ipo, i) => (
                <motion.div key={ipo.company} custom={i} variants={cardV} initial="hidden" animate="visible"
                  className="glass-card" style={{ padding: 28, border: '1px solid rgba(244,117,32,0.3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 24 }}>
                    {/* Left */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                          {ipo.logo}
                        </div>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>{ipo.company}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--brand-dim)', color: 'var(--brand)', fontWeight: 700 }}>{ipo.sector}</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,200,150,0.1)', color: 'var(--gain)', fontWeight: 700 }}>OPEN</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-mid)', color: 'var(--tx-3)', fontWeight: 600 }}>{ipo.exchange}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                          { label: 'Price Band', value: ipo.price, color: 'var(--tx)' },
                          { label: 'Issue Size',  value: ipo.size,  color: 'var(--tx)' },
                          { label: 'Opens',      value: ipo.opens,  color: 'var(--gold)' },
                          { label: 'Closes',     value: ipo.closes, color: 'var(--loss)' },
                        ].map(s => (
                          <div key={s.label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                            <div className="num" style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Middle — subscription */}
                    <div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700, marginBottom: 8 }}>SUBSCRIPTION STATUS</div>
                        <div className="num" style={{ fontSize: 32, fontWeight: 900, color: 'var(--brand)', marginBottom: 4 }}>{ipo.subscription}x</div>
                        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>Overall subscribed</div>
                      </div>
                      {ipo.subBreakup && (
                        <div>
                          <SubBar label="QIB"    val={ipo.subBreakup.qib}    color="var(--cyan)"   />
                          <SubBar label="NII"    val={ipo.subBreakup.nii}    color="var(--purple)" />
                          <SubBar label="Retail" val={ipo.subBreakup.retail} color="var(--gain)"   />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                        <StarRating n={ipo.rating} />
                        <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>StockVision rating</span>
                      </div>
                    </div>

                    {/* Right — GMP + CTA */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ padding: '18px 20px', background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 700, marginBottom: 6 }}>GREY MARKET PREMIUM</div>
                        <div className="num" style={{ fontSize: 28, fontWeight: 900, color: 'var(--gain)', marginBottom: 4 }}>{ipo.gmp}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <TrendingUp size={13} color="var(--gain)" />
                          <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gain)' }}>+{ipo.gmpPct}% est. listing gain</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 6 }}>GMP is unofficial and not guaranteed</div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setApplyModal({ company: ipo.company, price: ipo.price })}
                        style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Apply via Broker <ArrowRight size={14} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ UPCOMING IPOs ══ */}
        {tab === 'upcoming' && (
          <motion.div key="upcoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
              {UPCOMING_IPOS.map((ipo, i) => (
                <motion.div key={ipo.company} custom={i} variants={cardV} initial="hidden" animate="visible"
                  whileHover={{ y: -4 }} className="glass-card" style={{ padding: 24, cursor: 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface-mid)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {ipo.logo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>{ipo.company}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,166,35,0.1)', color: 'var(--gold)', fontWeight: 700 }}>UPCOMING</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-mid)', color: 'var(--tx-3)', fontWeight: 600 }}>{ipo.sector}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: ipo.type === 'SME' ? 'rgba(167,139,250,0.1)' : 'var(--brand-dim)', color: ipo.type === 'SME' ? 'var(--purple)' : 'var(--brand)', fontWeight: 700 }}>{ipo.type}</span>
                      </div>
                    </div>
                    <StarRating n={ipo.rating} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Price', value: ipo.price },
                      { label: 'Size',  value: ipo.size  },
                      { label: 'Opens', value: ipo.opens },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '9px 10px', background: 'var(--bg-elevated)', borderRadius: 9 }}>
                        <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 700, marginBottom: 3 }}>{s.label}</div>
                        <div className="num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(0,200,150,0.04)', border: '1px solid rgba(0,200,150,0.15)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 2 }}>GMP (Grey Market)</div>
                      <div className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gain)' }}>{ipo.gmp}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 2 }}>Est. Listing</div>
                      <div className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gain)' }}>+{ipo.gmpPct}%</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={13} color="var(--tx-3)" />
                      <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{ipo.closes}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ LISTED IPOs ══ */}
        {tab === 'listed' && (
          <motion.div key="listed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Company', 'Sector', 'Listed', 'Issue ₹', 'CMP ₹', 'Gain/Loss', 'Exchange'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: ['Company', 'Sector'].includes(h) ? 'left' : 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listedRows.map((ipo, i) => (
                      <motion.tr key={ipo.company} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        whileHover={{ background: 'rgba(244,117,32,0.04)' } as any}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{ipo.logo}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{ipo.company}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 6, background: 'var(--brand-dim)', color: 'var(--brand)', fontWeight: 600 }}>{ipo.sector}</span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 12.5, color: 'var(--tx-3)' }}>{ipo.listDate}</td>
                        <td className="num" style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>₹{ipo.issuePrice}</td>
                        <td className="num" style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>₹{ipo.cmp}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 800, padding: '4px 12px', borderRadius: 8, background: ipo.gain >= 0 ? 'rgba(0,200,150,0.1)' : 'rgba(255,77,106,0.1)', color: ipo.gain >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                            {ipo.gain >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {ipo.gain >= 0 ? '+' : ''}{ipo.gain}%
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 12, color: 'var(--tx-3)' }}>{ipo.exchange}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <Pagination page={listedPage} totalPages={listedTotalPages} onPageChange={setListedPage} totalItems={LISTED_IPOS.length} perPage={PER_PAGE} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ SME IPOs ══ */}
        {tab === 'sme' && (
          <motion.div key="sme" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertCircle size={16} color="var(--purple)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tx)' }}>SME/Emerge IPOs are high-risk.</strong> Minimum application lot sizes are larger. Only accredited investors with risk appetite should apply. These are listed on BSE SME or NSE Emerge platforms.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
              {SME_IPOS.map((ipo, i) => (
                <motion.div key={ipo.company} custom={i} variants={cardV} initial="hidden" animate="visible"
                  whileHover={{ y: -3 }} className="glass-card" style={{ padding: 22, border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 26 }}>{ipo.logo}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', marginBottom: 3 }}>{ipo.company}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: 'rgba(167,139,250,0.12)', color: 'var(--purple)', fontWeight: 700 }}>{ipo.exchange}</span>
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: 'var(--surface-mid)', color: 'var(--tx-3)', fontWeight: 600 }}>{ipo.sector}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <StarRating n={ipo.rating} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { l: 'Price Band', v: ipo.price, c: 'var(--tx)' },
                      { l: 'Issue Size', v: ipo.size,  c: 'var(--tx)' },
                      { l: 'Opens',      v: ipo.opens, c: 'var(--gold)' },
                      { l: 'Subscribed', v: `${ipo.subscription}x`, c: 'var(--gain)' },
                    ].map(s => (
                      <div key={s.l} style={{ padding: '9px 10px', background: 'var(--bg-elevated)', borderRadius: 9 }}>
                        <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 700, marginBottom: 3 }}>{s.l}</div>
                        <div className="num" style={{ fontSize: 12.5, fontWeight: 700, color: s.c }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,200,150,0.04)', borderRadius: 9, border: '1px solid rgba(0,200,150,0.15)' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600 }}>GMP</div>
                      <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--gain)' }}>{ipo.gmp}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600 }}>Est. Listing</div>
                      <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--gain)' }}>+{ipo.gmpPct}%</div>
                    </div>
                    <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: 'var(--purple)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Details
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ ELSS FUNDS ══ */}
        {tab === 'elss' && (
          <motion.div key="elss" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ padding: '14px 18px', background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 12, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Shield size={18} color="var(--gain)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--tx)' }}>ELSS funds save tax under Section 80C.</strong> Max deduction ₹1.5 Lakh/year. 3-year lock-in period. Best equity-linked tax saver.
                </div>
              </div>
              <div className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--gain)', padding: '6px 14px', background: 'rgba(0,200,150,0.1)', borderRadius: 8, whiteSpace: 'nowrap' }}>
                Save up to ₹46,800
              </div>
            </div>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Fund', 'NAV', '1Y Return', '3Y Return', '5Y Return', 'Expense', 'Min SIP', 'Rating'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: h === 'Fund' ? 'left' : 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ELSS_FUNDS.sort((a, b) => b.returns3y - a.returns3y).map((fund, i) => (
                      <motion.tr key={fund.name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        whileHover={{ background: 'rgba(244,117,32,0.04)' } as any}>
                        <td style={{ padding: '14px 14px' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{fund.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{fund.amc} · {fund.fundManager}</div>
                        </td>
                        <td className="num" style={{ padding: '14px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>₹{fund.nav}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gain)' }}>+{fund.returns1y}%</span>
                        </td>
                        <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 13, fontWeight: 800, color: fund.returns3y >= 25 ? 'var(--gain)' : 'var(--brand)' }}>+{fund.returns3y}%</span>
                        </td>
                        <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-2)' }}>+{fund.returns5y}%</span>
                        </td>
                        <td className="num" style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12.5, color: fund.expenseRatio < 0.6 ? 'var(--gain)' : 'var(--tx-2)' }}>{fund.expenseRatio}%</td>
                        <td className="num" style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12.5, color: 'var(--tx-2)' }}>₹{fund.minSIP}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right' }}><StarRating n={fund.rating} /></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 11.5, color: 'var(--tx-3)' }}>
                Returns as of May 2026. Past performance is not indicative of future returns. Lock-in period: 3 years.
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Apply via Broker modal ── */}
      {applyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 24, boxSizing: 'border-box' }}>
            {applySuccess ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gain)', marginBottom: 6 }}>Application Initiated</div>
                <div style={{ fontSize: 13, color: 'var(--tx-3)', lineHeight: 1.6 }}>
                  Redirecting to <strong style={{ color: 'var(--tx)' }}>{applySuccess}</strong> to complete your ASBA application for <strong style={{ color: 'var(--tx)' }}>{applyModal.company}</strong>.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', marginBottom: 4 }}>Apply via Broker</h3>
                    <p style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{applyModal.company} · {applyModal.price}</p>
                  </div>
                  <button onClick={() => setApplyModal(null)} style={{ border: 'none', background: 'transparent', color: 'var(--tx-3)', fontSize: 20, cursor: 'pointer', padding: '2px 4px' }}>×</button>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--tx-3)', marginBottom: 16, lineHeight: 1.6 }}>
                  Select your connected broker to apply. You'll be redirected to complete the ASBA application.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {CONNECTED_BROKERS.map(broker => (
                    <motion.button key={broker.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      onClick={() => handleApplyBroker(broker.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'border-color 150ms' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: broker.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                        {broker.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{broker.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{broker.note}</div>
                      </div>
                      <ArrowRight size={14} color="var(--tx-3)" />
                    </motion.button>
                  ))}
                </div>

                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(244,117,32,0.06)', border: '1px solid rgba(244,117,32,0.15)', fontSize: 11.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--brand)' }}>ASBA:</strong> Your funds are blocked — not debited — until allotment. No interest lost.
                </div>

                <button onClick={() => setApplyModal(null)}
                  style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
