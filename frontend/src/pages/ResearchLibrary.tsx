import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Share2, BookOpen, TrendingUp, Plus, Check, ChevronDown, ChevronUp, Zap, Eye, Star, Clock } from 'lucide-react';
import Pagination from '../components/ui/Pagination';

const PER_PAGE = 10;
import { mockResearchReports } from '../data/mockData';
import { useIsMobile } from '../hooks/useBreakpoint';
import { fetchResearchReports } from '../lib/api';
import { useStore } from '../store/useStore';

const themes = ['All', 'Defence', 'Budget', 'Valuation', 'Sector Rotation', 'Event-Driven'];

const themeStyle = (t: string): { bg: string; color: string } => {
  const map: Record<string, { bg: string; color: string }> = {
    Defence:           { bg: 'var(--brand-dim)',          color: 'var(--brand)' },
    Budget:            { bg: 'rgba(0,200,150,0.1)',        color: 'var(--gain)' },
    Valuation:         { bg: 'rgba(0,210,255,0.1)',        color: '#00D2FF' },
    'Sector Rotation': { bg: 'rgba(245,166,35,0.1)',       color: 'var(--gold)' },
    'Event-Driven':    { bg: 'rgba(167,139,250,0.1)',      color: 'var(--purple)' },
  };
  return map[t] ?? { bg: 'var(--bg-elevated)', color: 'var(--tx-3)' };
};

const confidenceColor = (score: number) => {
  if (score >= 8.5) return { bar: '#10b981', label: 'Very High', bg: 'rgba(16,185,129,0.12)' };
  if (score >= 7.0) return { bar: 'var(--brand)', label: 'High', bg: 'var(--brand-dim)' };
  if (score >= 5.5) return { bar: 'var(--gold)', label: 'Moderate', bg: 'rgba(245,166,35,0.1)' };
  return { bar: 'var(--loss)', label: 'Low', bg: 'rgba(255,77,106,0.1)' };
};

const reportPreviews: Record<string, { abstract: string; keyPoints: string[]; rating: string; analyst: string }> = {
  '1': {
    abstract: "India's Operation Sindoor marks a structural re-rating inflection for the domestic defence sector. Indigenisation mandates, accelerated budget allocation (₹6.2L Cr in FY27 BE), and a decade-long order backlog across HAL, BEL, and the MSME supply chain create a multi-year earnings visibility window that the market has only partially priced in.",
    keyPoints: [
      'HAL order book at ₹94,000 Cr (5x FY26 revenue) — LCA Mk2 & AMCA milestones act as catalysts',
      'BEL revenue mix shifting: 62% defence + 38% non-defence; margin expansion of 80–120 bps expected',
      'IdeaForge targets 200 drone exports to allied nations; FY27 revenue guide ₹320 Cr vs ₹180 Cr FY26',
      'MTAR Technologies riding DRDO & ISRO contracts; management guided 35%+ CAGR for 3 years',
      'Risk: Geopolitical de-escalation, order execution slippage, margin pressure from raw materials',
    ],
    rating: 'Overweight',
    analyst: 'StockVision AI — Defence Desk',
  },
  '2': {
    abstract: "Union Budget 2026–27 doubled capex allocation to ₹15.2L Cr, with ₹11L Cr earmarked for infrastructure. PSU heavy-weight beneficiaries in power transmission, railways, and urban infra remain the clearest plays. Our analysis identifies 5 high-conviction names with multi-year earnings certainty backed by government off-take guarantees.",
    keyPoints: [
      'NTPC: 15 GW capacity addition by FY28; green energy pivot adds ₹18/share DCF value',
      'POWERGRID: Tariff-regulated returns 15.5% ROE locked; dividend yield 4.8% offers floor support',
      'IRFC: Entire book backed by Railways MoF guarantee; NPA risk structurally zero',
      'L&T: Hydrocarbon + defence + infra trifecta; order inflow guidance ₹3L Cr for FY27',
      'Risk: FY28 election cycle fiscal slippage; interest rate sensitivity for rate-regulated utilities',
    ],
    rating: 'Overweight',
    analyst: 'StockVision AI — Macro & Policy Desk',
  },
  '3': {
    abstract: "Reliance Industries trades at 22x FY27E earnings — a 15% discount to its 5-year average multiple — while Jio's ARPU inflection (₹203 exit rate, guidance ₹220+) and New Energy capex of $75 Bn through FY30 are materially undervalued in consensus models. Our blended SOTP (Jio + Retail + O2C + Green) yields a fair value range of ₹3,100–₹3,400.",
    keyPoints: [
      'Jio ARPU trajectory: ₹181 (FY25) → ₹220 (FY27E) → ₹260 (FY29E) drives 14% FCF CAGR',
      'Reliance Retail: 18,836 stores, $100 Bn GMV target FY28; fashion & grocery 2 fastest growing verticals',
      'New Energy: 100 GW solar capacity by 2030; first mover in green hydrogen (Dhirubhai Ambani Green Energy City)',
      'O2C margin recovery: $/bbl crack spreads normalising post refinery upgrade cycle completion',
      'Key risk: Jio subscriber churn from BSNL revival; O2C oversupply pressure from Middle East mega-refineries',
    ],
    rating: 'Buy — Target ₹3,250',
    analyst: 'StockVision AI — Large Cap Desk',
  },
  '4': {
    abstract: "Q4 FY26 earnings season for PSU banks is shaping up as a consensus-beating quarter. NIM pressure from RBI rate cuts (–50 bps in FY26) has been offset by loan mix improvement, PCR strengthening to 78%, and a one-off treasury gain tailwind. Our sector rotation model flags SBI and BOB as the highest-probability outperformers in a rotation out of private banks.",
    keyPoints: [
      'SBI Q4E: NII ₹43,500 Cr (+9% YoY), PAT ₹19,200 Cr (+18%); ROE expanding to 16.8%',
      'BOB: Corporate loan growth 22% YoY; Gross NPA declining to 3.6% from 4.9% peak',
      'PNB completing bad-book clean-up; PCR at 80%+ signals inflection in credit quality',
      'Sector catalyst: RBI circular on priority-sector lending relaxation adding 40–60 bps to PSU NIMs',
      'Risk: Global risk-off (FII selling), any sovereign rating watch, Agri-loan waiver risk ahead of state elections',
    ],
    rating: 'Neutral → Overweight upgrade',
    analyst: 'StockVision AI — BFSI Desk',
  },
};

export default function ResearchLibrary() {
  const isMobile = useIsMobile();
  const { authToken } = useStore();
  const [search, setSearch]     = useState('');
  const [theme, setTheme]       = useState('All');
  const [copied, setCopied]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage]         = useState(1);
  const reportsQuery = useQuery({
    queryKey: ['research-reports', authToken],
    queryFn: () => fetchResearchReports(authToken),
  });
  const reports = reportsQuery.data ?? mockResearchReports;

  const filtered = reports.filter(r =>
    (theme === 'All' || r.theme === theme) &&
    (r.title.toLowerCase().includes(search.toLowerCase()) || r.theme.toLowerCase().includes(search.toLowerCase()))
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageReports = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleShare = (id: string) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };

  const toggleExpand = (id: string) => setExpanded(prev => prev === id ? null : id);

  const stats = [
    { label: 'Total Reports',   value: reports.length,                                      icon: BookOpen  },
    { label: 'Total Downloads', value: reports.reduce((a, r) => a + r.downloads, 0),        icon: Download  },
    { label: 'Times Shared',    value: reports.reduce((a, r) => a + r.shares, 0),           icon: Share2    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-0.02em', marginBottom: 4 }}>Research Reports Library</h1>
        <p style={{ fontSize: 13.5, color: 'var(--tx-3)' }}>
          AI-generated thematic reports, DCF analyses &amp; comps — institutional grade, shareable links
          <span style={{ color: authToken ? 'var(--gain)' : 'var(--gold)', marginLeft: 8 }}>
            {authToken ? 'Live library' : 'Demo library'}
          </span>
        </p>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reports…"
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, fontSize: 13.5, color: 'var(--tx)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {themes.map(t => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{ padding: '8px 14px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', border: theme === t ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: theme === t ? 'var(--brand-dim)' : 'transparent', color: theme === t ? 'var(--brand)' : 'var(--tx-3)' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 16 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, background: 'var(--brand-dim)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={17} color="var(--brand)" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx)' }}>{s.value.toLocaleString('en-IN')}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pageReports.map(report => {
          const ts  = themeStyle(report.theme);
          const cc  = confidenceColor(report.confidence);
          const isOpen = expanded === report.id;
          const preview = reportPreviews[report.id];

          return (
            <div
              key={report.id}
              className="card"
              style={{ overflow: 'hidden', transition: 'border-color 150ms' }}
            >
              {/* Card body */}
              <div style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Theme + date row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: ts.bg, color: ts.color }}>
                        {report.theme}
                      </span>
                      <Clock size={11} color="var(--tx-3)" />
                      <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{report.date}</span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 10, lineHeight: 1.4 }}>{report.title}</h3>

                    {/* Stock tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {report.stocksCovered.map(s => (
                        <span key={s} style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 99, border: '1px solid var(--border)', color: 'var(--tx-3)', background: 'var(--bg-elevated)' }}>{s}</span>
                      ))}
                    </div>

                    {/* Meta row: downloads + shares + AI Confidence meter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Download size={11} /> {report.downloads.toLocaleString('en-IN')} downloads
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Share2 size={11} /> {report.shares.toLocaleString('en-IN')} shares
                      </span>

                      {/* AI Confidence meter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={12} color={cc.bar} />
                        <span style={{ fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>AI Confidence</span>
                        <div style={{ width: 80, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${(report.confidence / 10) * 100}%`, height: '100%', background: cc.bar, borderRadius: 99, transition: 'width 600ms ease' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cc.bar, minWidth: 28 }}>{report.confidence}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: cc.bg, color: cc.bar, fontWeight: 600 }}>{cc.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-sm)', background: 'var(--brand)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <Download size={12} /> Download PDF
                    </button>
                    <button
                      onClick={() => handleShare(report.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-sm)', border: copied === report.id ? '1px solid rgba(0,200,150,0.4)' : '1px solid var(--border)', background: copied === report.id ? 'rgba(0,200,150,0.08)' : 'transparent', color: copied === report.id ? 'var(--gain)' : 'var(--tx-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 150ms' }}
                    >
                      {copied === report.id ? <Check size={12} /> : <Share2 size={12} />}
                      {copied === report.id ? 'Link Copied' : 'Share Report'}
                    </button>
                    <button style={{ padding: '8px 16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Re-brand PDF
                    </button>
                  </div>
                </div>

                {/* Share link confirmation */}
                {copied === report.id && (
                  <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)' }}>
                    <div style={{ fontSize: 12, color: 'var(--gain)', marginBottom: 3 }}>Report URL copied — stockvision.in/research/{report.id}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>Non-premium users see a 1-page preview with a sign-up prompt.</div>
                  </div>
                )}

                {/* Preview toggle */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => toggleExpand(report.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, padding: 0 }}
                  >
                    <Eye size={13} />
                    {isOpen ? 'Hide Preview' : 'Preview Report'}
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Expandable preview */}
              {isOpen && preview && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '20px 22px' }}>
                  {/* Analyst + rating badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TrendingUp size={13} color="var(--brand)" />
                      <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{preview.analyst}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 14px', borderRadius: 99, background: ts.bg, color: ts.color, border: `1px solid ${ts.color}33` }}>
                      <Star size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      {preview.rating}
                    </span>
                  </div>

                  {/* Abstract */}
                  <p style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.7, marginBottom: 16 }}>
                    {preview.abstract}
                  </p>

                  {/* Key points */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Key Takeaways</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {preview.keyPoints.map((pt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 99, background: i === preview.keyPoints.length - 1 ? 'rgba(255,77,106,0.12)' : 'var(--brand-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: i === preview.keyPoints.length - 1 ? 'var(--loss)' : 'var(--brand)' }}>{i === preview.keyPoints.length - 1 ? '!' : i + 1}</span>
                          </div>
                          <span style={{ fontSize: 13, color: i === preview.keyPoints.length - 1 ? 'var(--tx-3)' : 'var(--tx-2)', lineHeight: 1.55 }}>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Paywall nudge */}
                  <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'linear-gradient(90deg, var(--brand-dim) 0%, rgba(167,139,250,0.08) 100%)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--tx-2)' }}>Full report includes valuation model, sensitivity tables &amp; trade setup — 12 pages</span>
                    <button style={{ background: 'var(--brand)', border: 'none', color: '#fff', padding: '7px 18px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Download PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--tx-3)' }}>
            <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>No reports match your search</div>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={p => { setPage(p); }} totalItems={filtered.length} perPage={PER_PAGE} />
        )}
      </div>

      {/* CTA */}
      <div style={{ background: 'linear-gradient(135deg, rgba(244,117,32,0.12) 0%, rgba(167,139,250,0.08) 100%)', border: '1px solid rgba(244,117,32,0.3)', borderRadius: 'var(--r-md)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>Generate a New Research Report</div>
          <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>Run the 6-step AI framework on any sector, theme, or event. Delivered in &lt;60 seconds.</div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--brand)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={14} /> New Report — ₹499
        </button>
      </div>
    </div>
  );
}
