import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../hooks/useBreakpoint';
import {
  Filter, Download, RotateCcw, Search, Play,
  ChevronUp, ChevronDown, Package, Users, Terminal,
  SlidersHorizontal, Star, TrendingUp, TrendingDown,
  ArrowUpRight, ChevronLeft, ChevronRight, Bell,
} from 'lucide-react';
import { fetchScreener } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import Dropdown from '../components/ui/Dropdown';
import { usePlanAccess } from '../components/ui/PlanGate';

type Tab = 'screener' | 'query' | 'commodities' | 'shareholders';
type CapFilter = 'all' | 'large' | 'mid' | 'small';
type SortKey = 'score' | 'upside' | 'change' | 'pe' | 'marketCap' | 'roce';

interface ScreenedStock {
  id: string; ticker: string; name: string; price: number;
  change: number; changePct: number; convictionScore: number;
  pe: number | null; roce: number | null; debtEquity: number | null;
  promoterHolding: number | null; revenueGrowth: number | null;
  upside: number; target12m: number; risk: string; sector: string;
  cap?: string; marketCap?: number;
}

interface PresetScreen {
  id: number; name: string; query: string; count: number;
  tag: string; tagColor: string;
  Icon: React.FC<{ size?: number; color: string }>;
  iconColor: string; saved: number;
}

// ── Preset Screen SVG Icons ──────────────────────────────────

function GemIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3H18L22 9L12 21L2 9L6 3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={`${color}1a`} />
      <path d="M2 9H22" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 3L9 9M18 3L15 9M9 9L12 21M15 9L12 21" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function RocketIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 6.5 7.5 6.5 14H17.5C17.5 7.5 12 2 12 2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={`${color}1a`} />
      <path d="M6.5 14L4.5 18.5H19.5L17.5 14" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2" stroke={color} strokeWidth="1.5" />
      <path d="M9 18.5L8.5 22M15 18.5L15.5 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CoinsIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="9" cy="7.5" rx="5" ry="2.5" stroke={color} strokeWidth="1.7" fill={`${color}1a`} />
      <path d="M4 7.5V14.5C4 15.88 6.24 17 9 17C11.76 17 14 15.88 14 14.5V7.5" stroke={color} strokeWidth="1.7" />
      <ellipse cx="15" cy="11" rx="4" ry="2" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
      <path d="M11 11V17C11 18.1 12.79 19 15 19C17.21 19 19 18.1 19 17V11" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function BoltIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4 13H12L11 22L20 11H12L13 2Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={`${color}22`} />
    </svg>
  );
}

function PersonArrowIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.7" fill={`${color}18`} />
      <path d="M3 21V19C3 16.79 5.69 15 9 15H11" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 14L21 10M21 10H17.5M21 10V13.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 5.5V11.5C4 16.3 7.5 20.5 12 22C16.5 20.5 20 16.3 20 11.5V5.5L12 2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={`${color}18`} />
      <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L14 9H21L15.5 13.5L17.5 21L12 16.5L6.5 21L8.5 13.5L3 9H10L12 2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={`${color}1a`} />
    </svg>
  );
}

function TrendBreakoutIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="3,18 8,12 12,16 19,7" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,7 19,7 19,11" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="3" y1="21" x2="21" y2="21" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Commodity SVG Icons ──────────────────────────────────────

function GoldBarIcon({ size = 26, color = '#F59E0B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="9" width="18" height="10" rx="2.5" stroke={color} strokeWidth="1.8" fill={`${color}22`} />
      <rect x="6" y="5" width="12" height="6" rx="1.5" stroke={color} strokeWidth="1.6" fill={`${color}18`} />
      <line x1="7" y1="12.5" x2="17" y2="12.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7" y1="15.5" x2="17" y2="15.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function OilBarrelIcon({ size = 26, color = '#64748B' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 6C7 4.9 9.24 4 12 4C14.76 4 17 4.9 17 6V18C17 19.1 14.76 20 12 20C9.24 20 7 19.1 7 18V6Z" stroke={color} strokeWidth="1.7" fill={`${color}18`} />
      <ellipse cx="12" cy="6" rx="5" ry="2" stroke={color} strokeWidth="1.6" />
      <line x1="7" y1="10.5" x2="17" y2="10.5" stroke={color} strokeWidth="1.4" />
      <line x1="7" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.4" />
      <path d="M17 8L20 6V10L17 10" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SilverBarIcon({ size = 26, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="10" rx="2.5" stroke={color} strokeWidth="1.8" fill={`${color}22`} />
      <rect x="5" y="5" width="14" height="5" rx="1.5" stroke={color} strokeWidth="1.6" fill={`${color}18`} />
      <line x1="5" y1="13" x2="19" y2="13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="5" y1="15.5" x2="19" y2="15.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CopperCircleIcon({ size = 26, color = '#B87333' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.8" fill={`${color}18`} />
      <circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="1.3" fill={`${color}22`} />
      <text x="12" y="16" textAnchor="middle" fill={color} fontSize="6.5" fontWeight="800" fontFamily="'JetBrains Mono',monospace">Cu</text>
    </svg>
  );
}

// ── Data Constants ───────────────────────────────────────────

const PRESET_SCREENS: PresetScreen[] = [
  { id: 1, name: 'Deep Value',      query: 'Market Cap > 500 AND P/E < 15 AND ROCE > 15', count: 43,  tag: 'Value',    tagColor: '#22c55e', Icon: GemIcon,           iconColor: '#22c55e', saved: 1204 },
  { id: 2, name: 'Quality Growth',  query: 'Revenue Growth > 20 AND ROCE > 20',            count: 28,  tag: 'Growth',   tagColor: '#6366f1', Icon: RocketIcon,        iconColor: '#6366f1', saved: 987  },
  { id: 3, name: 'High Dividend',   query: 'Dividend Yield > 3 AND Debt to equity < 0.5',  count: 61,  tag: 'Income',   tagColor: '#f59e0b', Icon: CoinsIcon,         iconColor: '#f59e0b', saved: 756  },
  { id: 4, name: 'Momentum',        query: 'Price > 200 DMA AND Volume > 1.5x avg',        count: 19,  tag: 'Momentum', tagColor: '#a78bfa', Icon: BoltIcon,          iconColor: '#a78bfa', saved: 532  },
  { id: 5, name: 'Promoter Buying', query: 'Promoter Holding Qtr Change > 1',              count: 34,  tag: 'Insider',  tagColor: '#06b6d4', Icon: PersonArrowIcon,   iconColor: '#06b6d4', saved: 421  },
  { id: 6, name: 'Debt-Free',       query: 'Debt to equity < 0.1 AND Market Cap > 500',   count: 57,  tag: 'Safe',     tagColor: '#10b981', Icon: ShieldCheckIcon,   iconColor: '#10b981', saved: 834  },
  { id: 7, name: 'Small Cap Gems',  query: 'Market Cap < 5000 AND ROCE > 20',              count: 22,  tag: 'Small',    tagColor: '#f47520', Icon: SparkleIcon,       iconColor: '#f47520', saved: 298  },
  { id: 8, name: '52W Breakout',    query: 'Current Price = 52 Week High',                 count: 11,  tag: 'Breakout', tagColor: '#ec4899', Icon: TrendBreakoutIcon, iconColor: '#ec4899', saved: 645  },
];

const COMMODITY_STATS = [
  { label: 'Gold',      Icon: GoldBarIcon,    iconColor: '#F59E0B', val: '$2,318', chg: '+0.5%', up: true  },
  { label: 'Crude Oil', Icon: OilBarrelIcon,  iconColor: '#64748B', val: '$78.4',  chg: '-1.6%', up: false },
  { label: 'Silver',    Icon: SilverBarIcon,  iconColor: '#94A3B8', val: '$27.3',  chg: '+2.1%', up: true  },
  { label: 'Copper',    Icon: CopperCircleIcon, iconColor: '#B87333', val: '$4.41',  chg: '+1.8%', up: true  },
];

const QUERY_EXAMPLES = [
  { label: 'Buffett Formula',     query: 'Market Cap > 5000\nAND P/E < 25\nAND ROCE > 15\nAND Debt to equity < 0.5\nAND Promoter Holding > 50' },
  { label: 'Small Cap Quality',   query: 'Market Cap < 5000\nAND Market Cap > 500\nAND ROCE > 20\nAND Revenue Growth > 20\nAND P/E < 30' },
  { label: 'High ROCE Low Debt',  query: 'ROCE > 25\nAND Debt to equity < 0.3\nAND Current Ratio > 1.5' },
  { label: 'Momentum EPS Growth', query: 'Price to Earning < 35\nAND Sales growth > 15\nAND Return on equity > 15\nAND EPS Growth > 20' },
];

const COMMODITY_DATA = [
  { name: 'Crude Oil (WTI)', price: 78.42,  change: -1.23, unit: 'USD/bbl',   category: 'Energy'   },
  { name: 'Natural Gas',     price: 2.84,   change: +0.12, unit: 'USD/MMBtu', category: 'Energy'   },
  { name: 'Gold',            price: 2318.5, change: +12.4, unit: 'USD/oz',    category: 'Precious' },
  { name: 'Silver',          price: 27.34,  change: +0.58, unit: 'USD/oz',    category: 'Precious' },
  { name: 'Platinum',        price: 912.0,  change: -3.4,  unit: 'USD/oz',    category: 'Precious' },
  { name: 'Copper',          price: 4.41,   change: +0.08, unit: 'USD/lb',    category: 'Metals'   },
  { name: 'Aluminium',       price: 2287.0, change: -14.5, unit: 'USD/t',     category: 'Metals'   },
  { name: 'Zinc',            price: 2812.0, change: +22.0, unit: 'USD/t',     category: 'Metals'   },
  { name: 'Nickel',          price: 16420,  change: -180,  unit: 'USD/t',     category: 'Metals'   },
  { name: 'Cotton',          price: 81.4,   change: -0.6,  unit: 'USc/lb',    category: 'Agri'     },
  { name: 'Soybean',         price: 1168,   change: +8.5,  unit: 'USc/bu',    category: 'Agri'     },
  { name: 'Wheat',           price: 558,    change: -4.2,  unit: 'USc/bu',    category: 'Agri'     },
  { name: 'Sugar',           price: 18.74,  change: +0.22, unit: 'USc/lb',    category: 'Agri'     },
  { name: 'Rubber',          price: 178.2,  change: +1.8,  unit: 'JPY/kg',    category: 'Agri'     },
];

const SHAREHOLDER_DATA: Record<string, { company: string; ticker: string; holding: number; shares: number; change: string }[]> = {
  'Rakesh Jhunjhunwala': [
    { company: 'Titan Company', ticker: 'TITAN',      holding: 5.04,  shares: 44820000, change: '+0.2%' },
    { company: 'Tata Motors',   ticker: 'TATAMOTORS', holding: 1.12,  shares: 41200000, change: '0%'   },
    { company: 'Crisil',        ticker: 'CRISIL',     holding: 8.97,  shares: 12600000, change: '+1.1%' },
    { company: 'Nazara Tech',   ticker: 'NAZARA',     holding: 10.41, shares: 5200000,  change: '-0.3%' },
  ],
  'Ashish Kacholia': [
    { company: 'Saregama India',  ticker: 'SAREGAMA',   holding: 4.35, shares: 8120000, change: '+0.5%' },
    { company: 'Garware Tech',    ticker: 'GARFIBRES',  holding: 7.62, shares: 3840000, change: '0%'    },
    { company: 'Vinati Organics', ticker: 'VINATIORGA', holding: 1.18, shares: 3060000, change: '+0.2%' },
  ],
  'Vijay Kedia': [
    { company: 'Atul Auto',      ticker: 'ATULAUTO',   holding: 4.50, shares: 1980000, change: '-0.1%' },
    { company: 'Cera Sanitary',  ticker: 'CERA',       holding: 1.67, shares: 531000,  change: '0%'    },
    { company: 'Sudarshan Chem', ticker: 'SUDARSCHEM', holding: 2.33, shares: 3180000, change: '+0.4%' },
  ],
};

const CAP_RANGES: Record<CapFilter, { label: string; sub: string; color: string; min: number; max: number }> = {
  all:   { label: 'All',       sub: 'No cap filter',     color: 'var(--brand)', min: 0,     max: Infinity },
  large: { label: 'Large Cap', sub: '>₹20,000 Cr',      color: 'var(--brand)', min: 20000, max: Infinity },
  mid:   { label: 'Mid Cap',   sub: '₹5,000–20,000 Cr', color: '#A78BFA',      min: 5000,  max: 20000   },
  small: { label: 'Small Cap', sub: '<₹5,000 Cr',       color: '#34D399',      min: 0,     max: 5000    },
};

const SECTORS = ['All Sectors','Defence','IT','Banking','Energy','FMCG','Pharma','Auto','NBFC','Metals','Chemicals','Realty','Telecom','Aviation','Retail'];

const AVAILABLE_FIELDS = [
  ['Market Cap','₹ Cr'],['P/E','Trailing'],['ROCE','%'],['ROE','%'],
  ['Debt to equity','Ratio'],['Revenue Growth','% YoY'],['EPS Growth','% YoY'],
  ['Dividend Yield','%'],['Promoter Holding','%'],['Current Ratio','—'],['52 Week High','₹'],
];

// ── Helper Components ────────────────────────────────────────

function ChangeCell({ val }: { val: number }) {
  const pos = val >= 0;
  return (
    <td style={{ textAlign: 'right', padding: '12px 14px', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 12.5, color: pos ? 'var(--gain)' : 'var(--loss)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {pos ? <ChevronUp size={11} /> : <ChevronDown size={11} />}{Math.abs(val).toFixed(2)}%
      </span>
    </td>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 8 ? 'var(--gain)' : score >= 6 ? 'var(--brand)' : score >= 4 ? '#F5A623' : 'var(--loss)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, background: `${color}18`, border: `1px solid ${color}40`, fontSize: 11.5, fontWeight: 700, color }}>
      {score.toFixed(1)}
    </span>
  );
}

const btnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface-mid)',
  color: 'var(--tx-3)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

// ── Main Component ───────────────────────────────────────────

export default function Screener() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isPremium = usePlanAccess('premium');
  const [activeTab, setActiveTab]     = useState<Tab>('screener');
  const [capFilter, setCapFilter]     = useState<CapFilter>('all');
  const [universe, setUniverse]       = useState<'nifty50' | 'nifty200' | 'nifty500'>('nifty200');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey]         = useState<SortKey>('score');
  const [sortAsc, setSortAsc]         = useState(false);
  const [page, setPage]               = useState(1);
  const PER_PAGE = 15;

  const [queryText, setQueryText]       = useState('Market Cap > 500\nAND P/E < 25\nAND ROCE > 15\nAND Debt to equity < 0.5');
  const [queryRan, setQueryRan]         = useState(false);
  const [queryRunning, setQueryRunning] = useState(false);

  const [commodityCat, setCommodityCat] = useState('All');

  const [shareholderQ, setShareholderQ]           = useState('');
  const [shareholderResult, setShareholderResult] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    minScore: 0, maxPE: 100, minROCE: 0, maxDebt: 5,
    minPromoter: 0, minRevGrowth: -50, sector: '',
  });
  const setF = (key: string, value: number | string) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };

  const reqFilters = useMemo(() => ({
    min_conviction_score: filters.minScore, max_pe: filters.maxPE,
    min_roce: filters.minROCE, max_debt_equity: filters.maxDebt,
    min_promoter_holding: filters.minPromoter, min_revenue_growth: filters.minRevGrowth,
    sector: filters.sector || null,
    cap: capFilter !== 'all' ? capFilter : null,
    universe,
    sort_by: 'conviction_score',
    limit: universe === 'nifty500' ? 200 : universe === 'nifty200' ? 100 : 50,
  }), [filters, capFilter, universe]);

  const deferredFilters = useDeferredValue(reqFilters);
  const sq = useQuery({ queryKey: ['screener', deferredFilters], queryFn: () => fetchScreener(deferredFilters) });

  const sorted = useMemo(() => {
    const rows = (sq.data ?? []) as ScreenedStock[];
    // Cap filter is now applied server-side via the `cap` param; client-side
    // we still filter to handle the mock-data fallback (which uses CAP_RANGES).
    const cap  = CAP_RANGES[capFilter];
    const filtered = rows.filter(r => {
      if (capFilter === 'all') return true;
      // Prefer backend cap field; fall back to market-cap ranges for mock data
      if ((r as any).cap) return (r as any).cap === capFilter;
      const mc = r.marketCap ?? 50000;
      return mc >= cap.min && mc < cap.max;
    });
    return [...filtered].sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'score':    va = a.convictionScore ?? 0; vb = b.convictionScore ?? 0; break;
        case 'upside':   va = a.upside ?? 0;          vb = b.upside ?? 0;          break;
        case 'change':   va = a.changePct ?? 0;       vb = b.changePct ?? 0;       break;
        case 'pe':       va = a.pe ?? 999;             vb = b.pe ?? 999;            break;
        case 'roce':     va = a.roce ?? 0;             vb = b.roce ?? 0;            break;
        default:         va = a.marketCap ?? 0;        vb = b.marketCap ?? 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [sq.data, capFilter, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const pageRows   = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(a => !a); else { setSortKey(k); setSortAsc(false); }
  };

  const handleRunQuery = () => {
    setQueryRunning(true);
    setTimeout(() => { setQueryRunning(false); setQueryRan(true); }, 1000);
  };

  const exportCSV = () => {
    const headers = ['Ticker','Name','Price','Change%','AI Score','P/E','ROCE','D/E','Upside%','Sector'];
    const rows = sorted.map(s => [s.ticker, s.name, s.price, s.changePct?.toFixed(2), s.convictionScore?.toFixed(1), s.pe, s.roce, s.debtEquity, s.upside, s.sector]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'stockvision-screen.csv'; a.click();
  };

  const filteredComms  = commodityCat === 'All' ? COMMODITY_DATA : COMMODITY_DATA.filter(c => c.category === commodityCat);
  const shResults      = shareholderResult ? (SHAREHOLDER_DATA[shareholderResult] ?? []) : [];
  const activeCap      = CAP_RANGES[capFilter];
  const hasActiveFilter = filters.minScore > 0 || filters.maxPE < 100 || filters.minROCE > 0;

  const TABS = [
    { id: 'screener'     as Tab, label: 'Stock Screen',        icon: <Filter size={13} /> },
    { id: 'query'        as Tab, label: 'Query Runner',        icon: <Terminal size={13} /> },
    { id: 'commodities'  as Tab, label: 'Commodity Prices',    icon: <Package size={13} /> },
    { id: 'shareholders' as Tab, label: 'Search Shareholders', icon: <Users size={13} /> },
  ];

  return (
    <div style={{ maxWidth: 1400, width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.03em', marginBottom: 4 }}>Stock Screener</h1>
            <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>
              Run queries on 10+ years of financial data · <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{sorted.length}</span> stocks match
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowFilters(f => !f)}
              style={{ ...btnBase, border: showFilters ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)', background: showFilters ? 'rgba(244,117,32,0.12)' : 'var(--surface-mid)', color: showFilters ? 'var(--brand)' : 'var(--tx-3)' }}>
              <SlidersHorizontal size={13} /> Filters
              {hasActiveFilter && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginLeft: 2 }} />}
            </button>
            <button onClick={exportCSV} style={btnBase}>
              <Download size={13} /> Export CSV
            </button>
            <button style={{ ...btnBase, border: '1px solid rgba(244,117,32,0.4)', background: 'rgba(244,117,32,0.1)', color: 'var(--brand)' }}>
              <Bell size={13} /> Set Alert
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', borderTop: 'none', borderRight: 'none', borderBottom: activeTab === t.id ? '2px solid var(--brand)' : '2px solid transparent', borderLeft: 'none', color: activeTab === t.id ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms', marginBottom: -1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ══ SCREENER TAB ══════════════════════════════════════ */}
        {activeTab === 'screener' && (
          <motion.div key="screener" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>

            {/* Universe selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Universe</span>
              {([
                { id: 'nifty50',  label: 'NIFTY 50',  sub: '50 stocks',  locked: false },
                { id: 'nifty200', label: 'NIFTY 200', sub: '~100 stocks', locked: false },
                { id: 'nifty500', label: 'NIFTY 500', sub: '200+ stocks', locked: !isPremium },
              ] as { id: 'nifty50' | 'nifty200' | 'nifty500'; label: string; sub: string; locked: boolean }[]).map(u => {
                const active = universe === u.id;
                return (
                  <button key={u.id}
                    onClick={() => { if (!u.locked) { setUniverse(u.id); setPage(1); } }}
                    title={u.locked ? 'Requires Premium plan' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: active ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: active ? 'var(--brand-dim)' : 'var(--surface-mid)', color: active ? 'var(--brand)' : u.locked ? 'var(--tx-3)' : 'var(--tx-2)', cursor: u.locked ? 'not-allowed' : 'pointer', opacity: u.locked ? 0.6 : 1, transition: 'all 150ms', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600 }}>
                    {u.label}
                    <span style={{ fontSize: 10, color: active ? 'var(--brand)' : 'var(--tx-3)', fontWeight: 500 }}>{u.sub}</span>
                    {u.locked && <Package size={11} color="var(--tx-3)" />}
                  </button>
                );
              })}
              {sq.isFetching && (
                <span style={{ fontSize: 11, color: 'var(--tx-3)', marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} />
                  Loading…
                </span>
              )}
            </div>

            {/* Cap filter + sector row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(CAP_RANGES) as CapFilter[]).map(k => {
                  const c = CAP_RANGES[k]; const active = capFilter === k;
                  return (
                    <button key={k} onClick={() => { setCapFilter(k); setPage(1); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '9px 18px', borderRadius: 10, border: active ? `1px solid ${c.color}60` : '1px solid var(--border)', background: active ? `${c.color}12` : 'var(--surface-mid)', cursor: 'pointer', transition: 'all 150ms', minWidth: 90, fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? c.color : 'var(--tx-2)' }}>{c.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2 }}>{c.sub}</span>
                    </button>
                  );
                })}
              </div>
              <Dropdown
                value={filters.sector}
                onChange={val => setF('sector', val)}
                options={SECTORS.map(s => ({ label: s, value: s === 'All Sectors' ? '' : s }))}
                placeholder="All Sectors"
                style={{ minWidth: 150 }}
              />
            </div>

            {/* Collapsible filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div key="fp" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                  className="glass-card" style={{ padding: 24, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 24 }}>
                    {[
                      { label: 'Min AI Score',     key: 'minScore',    min: 0,   max: 10,  step: 0.5, premium: false },
                      { label: 'Max P/E',           key: 'maxPE',       min: 0,   max: 200, step: 5,   premium: false },
                      { label: 'Min ROCE %',        key: 'minROCE',     min: 0,   max: 60,  step: 1,   premium: false },
                      { label: 'Max Debt/Equity',   key: 'maxDebt',     min: 0,   max: 5,   step: 0.1, premium: false },
                      { label: 'Min Promoter %',    key: 'minPromoter', min: 0,   max: 100, step: 5,   premium: false },
                      { label: 'Min Rev Growth %',  key: 'minRevGrowth',min: -50, max: 100, step: 5,   premium: true  },
                    ].map(f => (
                      <div key={f.key} style={{ position: 'relative' }}>
                        {f.premium && !isPremium && (
                          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--bg-card)', borderRadius: 8, border: '1px dashed rgba(244,117,32,0.4)', cursor: 'pointer' }} onClick={() => navigate('/app/settings')}>
                            <span style={{ fontSize: 10, color: 'var(--brand)' }}>🔒 Premium</span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--brand)' }}>Upgrade →</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, opacity: f.premium && !isPremium ? 0.3 : 1 }}>
                          <label style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 600 }}>{f.label}</label>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx)', fontFamily: "'JetBrains Mono',monospace" }}>
                            {(filters as Record<string, number | string>)[f.key]}
                          </span>
                        </div>
                        <input type="range" min={f.min} max={f.max} step={f.step}
                          value={(filters as Record<string, number | string>)[f.key] as number}
                          onChange={e => setF(f.key, parseFloat(e.target.value))}
                          disabled={f.premium && !isPremium}
                          style={{ width: '100%', accentColor: 'var(--brand)', cursor: f.premium && !isPremium ? 'not-allowed' : 'pointer', opacity: f.premium && !isPremium ? 0.3 : 1 }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setFilters({ minScore: 0, maxPE: 100, minROCE: 0, maxDebt: 5, minPromoter: 0, minRevGrowth: -50, sector: '' })}
                    style={{ ...btnBase, marginTop: 18 }}>
                    <RotateCcw size={12} /> Reset filters
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preset screens */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 12 }}>Popular Screens</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10 }}>
                {PRESET_SCREENS.map(ps => (
                  <motion.button key={ps.id}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => { setActiveTab('query'); setQueryText(ps.query); }}
                    style={{ padding: '13px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-mid)', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms', fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ps.iconColor}18`, border: `1px solid ${ps.iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ps.Icon size={20} color={ps.iconColor} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: `${ps.tagColor}15`, color: ps.tagColor, border: `1px solid ${ps.tagColor}30` }}>{ps.tag}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{ps.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{ps.count} stocks</span>
                      <span style={{ fontSize: 10.5, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Star size={9} /> {ps.saved}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Sort bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '10px 16px', background: 'var(--surface-mid)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>
                {sq.isLoading
                  ? <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }}>Scanning NSE…</motion.span>
                  : <><span style={{ color: 'var(--tx)', fontWeight: 700 }}>{sorted.length}</span> stocks · {activeCap.label} · Page {page}/{totalPages || 1}</>
                }
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['score', 'upside', 'change', 'pe', 'roce', 'marketCap'] as SortKey[]).map(s => (
                  <button key={s} onClick={() => handleSort(s)}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: sortKey === s ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)', background: sortKey === s ? 'rgba(244,117,32,0.12)' : 'transparent', color: sortKey === s ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 120ms', fontFamily: 'inherit' }}>
                    {s === 'score' ? 'AI Score' : s === 'marketCap' ? 'Mkt Cap' : s === 'pe' ? 'P/E' : s === 'roce' ? 'ROCE' : s === 'upside' ? 'Upside' : 'Change'}
                    {sortKey === s && (sortAsc ? ' ↑' : ' ↓')}
                  </button>
                ))}
              </div>
            </div>

            {/* Results table */}
            <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 14 }}>
              {sq.isLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: 12 }}>
                    <Filter size={22} color="var(--brand)" />
                  </motion.div>
                  <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>Scanning NSE live market data…</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                        <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}># Stock</th>
                        <th style={{ padding: '11px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Price</th>
                        {[['Change', 'change'], ['AI Score', 'score'], ['P/E', 'pe'], ['ROCE %', 'roce'], ['D/E Ratio', 'score'], ['Upside', 'upside'], ['Mkt Cap', 'marketCap']].map(([l, k]) => (
                          <th key={l} onClick={() => handleSort(k as SortKey)}
                            style={{ padding: '11px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: sortKey === k ? 'var(--brand)' : 'var(--tx-3)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', transition: 'color 150ms' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {l} {sortKey === k && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                            </span>
                          </th>
                        ))}
                        <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Sector</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((s, i) => (
                        <motion.tr key={s.ticker}
                          initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                          onClick={() => navigate(`/app/stock/${s.ticker}`)}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          whileHover={{ background: 'rgba(244,117,32,0.05)' } as any}>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace', width: 22, flexShrink: 0 }}>{(page - 1) * PER_PAGE + i + 1}</span>
                              <div>
                                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 1 }}>{s.ticker}</p>
                                <p style={{ fontSize: 11, color: 'var(--tx-3)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', whiteSpace: 'nowrap' }}>₹{s.price?.toLocaleString('en-IN')}</td>
                          <ChangeCell val={s.changePct} />
                          <td style={{ textAlign: 'right', padding: '13px 14px' }}><ScorePill score={s.convictionScore} /></td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: 'var(--tx-2)' }}>{s.pe ? s.pe.toFixed(1) : '—'}</td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: s.roce && s.roce > 15 ? 'var(--gain)' : 'var(--tx-2)' }}>{s.roce ? s.roce.toFixed(1) + '%' : '—'}</td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: s.debtEquity != null && s.debtEquity < 0.5 ? 'var(--gain)' : s.debtEquity != null && s.debtEquity > 2 ? 'var(--loss)' : 'var(--tx-2)' }}>{s.debtEquity != null ? s.debtEquity.toFixed(2) : '—'}</td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: s.upside > 0 ? 'var(--gain)' : 'var(--loss)' }}>{s.upside > 0 ? '+' : ''}{s.upside}%</td>
                          <td style={{ textAlign: 'right', padding: '13px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--tx-3)' }}>
                            {s.marketCap ? `₹${(s.marketCap / 1000).toFixed(0)}K Cr` : '—'}
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'var(--brand-dim)', color: 'var(--brand)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.sector}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  {sorted.length === 0 && !sq.isLoading && (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--tx-3)' }}>
                      <Filter size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 15, color: 'var(--tx)', marginBottom: 6 }}>No stocks match</div>
                      <div style={{ fontSize: 13 }}>Relax your filters or switch cap segment</div>
                    </div>
                  )}
                </div>
              )}

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>
                    Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} of {sorted.length}
                  </span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: page === 1 ? 'var(--tx-3)' : 'var(--tx)', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontFamily: 'inherit' }}>
                      <ChevronLeft size={13} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pg => (
                      <button key={pg} onClick={() => setPage(pg)}
                        style={{ padding: '6px 11px', borderRadius: 7, border: pg === page ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)', background: pg === page ? 'rgba(244,117,32,0.15)' : 'transparent', color: pg === page ? 'var(--brand)' : 'var(--tx-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {pg}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: page === totalPages ? 'var(--tx-3)' : 'var(--tx)', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontFamily: 'inherit' }}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ QUERY RUNNER TAB ══════════════════════════════════ */}
        {activeTab === 'query' && (
          <motion.div key="query" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 260px)', gap: 20 }}>

            {/* Left: editor + results */}
            <div style={{ minWidth: 0 }}>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
                {/* Editor header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={14} color="var(--brand)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>Query Editor</span>
                    <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.10)', color: 'var(--gain)', fontWeight: 700 }}>LIVE</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setQueryText('')}
                      style={{ ...btnBase, padding: '5px 11px', fontSize: 12 }}>
                      Clear
                    </button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handleRunQuery} disabled={queryRunning}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f47520,#f5a623)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {queryRunning
                        ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7 }}><RotateCcw size={13} /></motion.span>
                        : <Play size={13} />}
                      {queryRunning ? 'Running…' : 'Run Query'}
                    </motion.button>
                  </div>
                </div>

                {/* Code editor — always dark bg so #79c0ff is fine here */}
                <textarea value={queryText} onChange={e => setQueryText(e.target.value)} spellCheck={false}
                  style={{ width: '100%', minHeight: 200, padding: '18px 20px', background: '#0d1117', border: 'none', outline: 'none', color: '#79c0ff', fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 14, lineHeight: 1.75, resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder={'Market Cap > 500\nAND P/E < 25\nAND ROCE > 15\nAND Debt to equity < 0.5'} />

                <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <span>Fields: Market Cap, P/E, ROCE, Debt to equity, EPS Growth, Revenue Growth…</span>
                  <span>Operators: {'>'} {'<'} {'='} AND OR</span>
                </div>
              </div>

              {/* Results */}
              <AnimatePresence>
                {queryRan ? (
                  <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="glass-card" style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gain)', display: 'inline-block' }} />
                          <span style={{ fontSize: 13, color: 'var(--tx)' }}>
                            Query matched <strong>{sorted.length}</strong> stocks
                          </span>
                        </div>
                        <button onClick={exportCSV}
                          style={{ ...btnBase, padding: '5px 12px', fontSize: 12 }}>
                          <Download size={11} /> Export
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                              {['Stock', 'Price', 'Change', 'AI Score', 'P/E', 'ROCE', 'D/E', 'Upside', 'Sector'].map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: ['Stock', 'Sector'].includes(h) ? 'left' : 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.slice(0, 20).map((s, i) => (
                              <motion.tr key={s.ticker} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                onClick={() => navigate(`/app/stock/${s.ticker}`)}
                                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                whileHover={{ background: 'rgba(244,117,32,0.05)' } as any}>
                                <td style={{ padding: '11px 14px' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--tx)', fontSize: 13 }}>{s.ticker}</span>
                                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--tx-3)' }}>{s.name}</span>
                                </td>
                                <td style={{ textAlign: 'right', padding: '11px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>₹{s.price?.toLocaleString('en-IN')}</td>
                                <ChangeCell val={s.changePct} />
                                <td style={{ textAlign: 'right', padding: '11px 14px' }}><ScorePill score={s.convictionScore} /></td>
                                <td style={{ textAlign: 'right', padding: '11px 14px', fontFamily: 'monospace', fontSize: 12.5, color: 'var(--tx-2)' }}>{s.pe?.toFixed(1) ?? '—'}</td>
                                <td style={{ textAlign: 'right', padding: '11px 14px', fontFamily: 'monospace', fontSize: 12.5, color: s.roce && s.roce > 15 ? 'var(--gain)' : 'var(--tx-2)' }}>{s.roce?.toFixed(1) ?? '—'}%</td>
                                <td style={{ textAlign: 'right', padding: '11px 14px', fontFamily: 'monospace', fontSize: 12.5, color: 'var(--tx-2)' }}>{s.debtEquity?.toFixed(2) ?? '—'}</td>
                                <td style={{ textAlign: 'right', padding: '11px 14px', fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: s.upside > 0 ? 'var(--gain)' : 'var(--loss)' }}>{s.upside > 0 ? '+' : ''}{s.upside}%</td>
                                <td style={{ padding: '11px 14px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--brand-dim)', color: 'var(--brand)', fontWeight: 600 }}>{s.sector}</span></td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                      <Terminal size={36} style={{ margin: '0 auto 12px', opacity: 0.2, color: 'var(--tx)' }} />
                      <p style={{ fontSize: 14, color: 'var(--tx)', fontWeight: 600, marginBottom: 6 }}>Write your query and click Run</p>
                      <p style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Use AND/OR to combine conditions. Supports 50+ financial parameters.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: examples + fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <div className="glass-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 14 }}>Example Queries</p>
                {QUERY_EXAMPLES.map(ex => (
                  <button key={ex.label} onClick={() => setQueryText(ex.query)}
                    style={{ width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-mid)', cursor: 'pointer', marginBottom: 8, transition: 'all 150ms', fontFamily: 'inherit' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 5 }}>{ex.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--brand)', fontFamily: 'monospace', lineHeight: 1.6 }}>{ex.query.slice(0, 55)}…</p>
                  </button>
                ))}
              </div>

              <div className="glass-card" style={{ padding: 18 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx-3)', marginBottom: 12 }}>Available Fields</p>
                {AVAILABLE_FIELDS.map(([f, u]) => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--brand)', fontFamily: 'monospace', fontWeight: 600 }}>{f}</span>
                    <span style={{ color: 'var(--tx-3)' }}>{u}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ COMMODITIES TAB ═══════════════════════════════════ */}
        {activeTab === 'commodities' && (
          <motion.div key="commodities" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>Commodity Prices</h2>
                <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>Live prices via NYMEX / LME / CBOT · Updated daily</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gain)', display: 'inline-block', boxShadow: '0 0 8px var(--gain)' }} />
                <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Live</span>
              </div>
            </div>

            {/* Stat cards with SVG icons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 22 }}>
              {COMMODITY_STATS.map(c => (
                <div key={c.label} className="glass-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${c.iconColor}16`, border: `1px solid ${c.iconColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.Icon size={26} color={c.iconColor} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11.5, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>{c.label}</p>
                    <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>{c.val}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: c.up ? 'var(--gain)' : 'var(--loss)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {c.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {c.chg}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {['All', 'Energy', 'Precious', 'Metals', 'Agri'].map(cat => (
                <button key={cat} onClick={() => setCommodityCat(cat)}
                  style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: commodityCat === cat ? '1px solid rgba(244,117,32,0.5)' : '1px solid var(--border)', background: commodityCat === cat ? 'rgba(244,117,32,0.12)' : 'var(--surface-mid)', color: commodityCat === cat ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms', fontFamily: 'inherit' }}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                      {['Commodity', 'Category', 'Price', 'Change', '24h %', 'Unit'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: ['Commodity', 'Category', 'Unit'].includes(h) ? 'left' : 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComms.map((c, i) => {
                      const pos = c.change >= 0;
                      const pct = ((Math.abs(c.change) / c.price) * 100).toFixed(2);
                      return (
                        <motion.tr key={c.name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          style={{ borderBottom: '1px solid var(--border)' }}
                          whileHover={{ background: 'rgba(244,117,32,0.04)' } as any}>
                          <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{c.name}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 6, background: 'var(--surface-mid)', color: 'var(--tx-3)', fontWeight: 600 }}>{c.category}</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '13px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{c.price.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '13px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: pos ? 'var(--gain)' : 'var(--loss)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              {pos ? <ChevronUp size={11} /> : <ChevronDown size={11} />}{pos ? '+' : ''}{c.change}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '13px 16px' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: pos ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', color: pos ? 'var(--gain)' : 'var(--loss)' }}>
                              {pos ? '+' : '-'}{pct}%
                            </span>
                          </td>
                          <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{c.unit}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 11.5, color: 'var(--tx-3)' }}>
                Showing {filteredComms.length} commodities · Premium unlocks 10,000+ products with 10Y history
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ SHAREHOLDERS TAB ══════════════════════════════════ */}
        {activeTab === 'shareholders' && (
          <motion.div key="shareholders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <div style={{ maxWidth: 820 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Search Shareholders</h2>
              <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 24 }}>
                Find all companies where a person or entity owns more than 1% of shares. Data from quarterly shareholding disclosures (NSE/BSE).
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, minWidth: 0 }}>
                  <Search size={15} color="var(--tx-3)" />
                  <input value={shareholderQ} onChange={e => setShareholderQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { const m = Object.keys(SHAREHOLDER_DATA).find(k => k.toLowerCase().includes(shareholderQ.toLowerCase())); setShareholderResult(m ?? ''); } }}
                    placeholder="Search investor name…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: 14, padding: '14px 0', fontFamily: 'inherit', minWidth: 0 }} />
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { const m = Object.keys(SHAREHOLDER_DATA).find(k => k.toLowerCase().includes(shareholderQ.toLowerCase())); setShareholderResult(m ?? ''); }}
                  style={{ padding: '0 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f47520,#f5a623)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  Search
                </motion.button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                <span style={{ fontSize: 12, color: 'var(--tx-3)', alignSelf: 'center', fontWeight: 600 }}>Try:</span>
                {Object.keys(SHAREHOLDER_DATA).map(name => (
                  <button key={name} onClick={() => { setShareholderQ(name); setShareholderResult(name); }}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-mid)', color: 'var(--tx-2)', transition: 'all 150ms', fontFamily: 'inherit' }}>
                    {name}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {shareholderResult !== null && (
                  <motion.div key={shareholderResult ?? 'empty'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {shResults.length === 0 ? (
                      <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx-3)' }}>
                        <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 15, color: 'var(--tx)', marginBottom: 6 }}>No results found</div>
                        <div style={{ fontSize: 13 }}>Try: Rakesh Jhunjhunwala, Ashish Kacholia, or Vijay Kedia</div>
                      </div>
                    ) : (
                      <div className="glass-card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={18} color="var(--brand)" />
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{shareholderResult}</p>
                            <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>{shResults.length} companies · ≥1% shareholding disclosed</p>
                          </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                                {['Company', 'Ticker', 'Holding %', 'No. of Shares', 'QoQ Change', 'Action'].map(h => (
                                  <th key={h} style={{ padding: '10px 16px', textAlign: ['Action'].includes(h) ? 'center' : ['Company', 'Ticker'].includes(h) ? 'left' : 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--tx-3)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {shResults.map((r, i) => {
                                const up = r.change.startsWith('+'); const flat = r.change === '0%';
                                return (
                                  <motion.tr key={r.ticker} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                                    style={{ borderBottom: '1px solid var(--border)' }}
                                    whileHover={{ background: 'rgba(244,117,32,0.04)' } as any}>
                                    <td style={{ padding: '14px 16px', fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>{r.company}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <span style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 10px', borderRadius: 7, background: 'var(--brand-dim)', color: 'var(--brand)' }}>{r.ticker}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '14px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: 'var(--tx)' }}>{r.holding}%</td>
                                    <td style={{ textAlign: 'right', padding: '14px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--tx-2)' }}>{r.shares.toLocaleString('en-IN')}</td>
                                    <td style={{ textAlign: 'right', padding: '14px 16px', fontSize: 13, fontWeight: 700, color: flat ? 'var(--tx-3)' : up ? 'var(--gain)' : 'var(--loss)' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        {!flat && (up ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                                        {r.change}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                      <button onClick={() => navigate(`/app/stock/${r.ticker}`)}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(244,117,32,0.3)', background: 'var(--brand-dim)', color: 'var(--brand)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        View <ArrowUpRight size={11} />
                                      </button>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: '11px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 11.5, color: 'var(--tx-3)' }}>
                          Source: NSE Quarterly Shareholding Pattern · Q4 FY26
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {shareholderResult === null && (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: 'var(--tx-3)' }}>
                  <Users size={40} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
                  <div style={{ fontSize: 15, color: 'var(--tx)', marginBottom: 8 }}>Find company stakeholders</div>
                  <div style={{ fontSize: 13 }}>Search any investor name to see their disclosed holdings across BSE & NSE listed companies</div>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
