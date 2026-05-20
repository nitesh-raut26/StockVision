import { Link } from 'react-router-dom';
import { Share2, Users, Play, Mail, ShieldCheck, ExternalLink } from 'lucide-react';
import { LEGAL_SLUGS } from '../../data/legalSlugs';
import { useMediaQuery } from '../../hooks/useBreakpoint';

/* Always dark — never inherits app theme */
const BG      = '#0a0a0c';
const BORDER  = '#1a1c28';
const TX_MID  = '#7c8196';
const TX_DIM  = '#3e4258';

const PRODUCT_LINKS = [
  'Stock Screener', 'DCF Builder', 'Backtesting', 'Options Chain',
  'IPO Tracker', 'AI Research', 'Mutual Funds', 'Tax Tracker',
];

const COMPANY_LINKS = ['About Us', 'Blog', 'Careers', 'Press Kit', 'Contact'];
const DEVELOPER_LINKS = ['API Reference', 'SDKs', 'API Pricing', 'Changelog', 'System Status', 'API Support'];

const LEGAL_LINKS = ['Privacy Policy', 'Terms of Service', 'Disclaimer', 'Cookie Policy', 'SEBI Disclosure'];

export default function Footer() {
  const year = new Date().getFullYear();
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <footer style={{ background: BG, borderTop: `1px solid ${BORDER}`, color: TX_MID, fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '36px 20px 20px' : '44px 28px 24px' }}>

        {/* Top grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'minmax(200px, 260px) repeat(4, 1fr)',
          gap: isMobile ? '28px 20px' : '32px 32px',
          marginBottom: 32,
        }}>

          {/* Brand column — full width on mobile */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{
                width: 30, height: 30, background: '#f47520', borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="9.5" width="3" height="5" rx="0.8" fill="white" />
                  <rect x="6.5" y="6" width="3" height="8.5" rx="0.8" fill="white" />
                  <rect x="11.5" y="1.5" width="3" height="13" rx="0.8" fill="white" />
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                StockVision
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: TX_DIM, lineHeight: 1.75, marginBottom: 18, maxWidth: 230 }}>
              India's most intelligent stock research platform — AI-powered, built for serious investors.
            </p>

            {/* Social icons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { Icon: Share2, href: '#' },
                { Icon: Users,  href: '#' },
                { Icon: Play,   href: '#' },
                { Icon: Mail,   href: 'mailto:support@stockvision.in' },
              ] as const).map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  style={{
                    width: 32, height: 32, borderRadius: 9, background: BORDER,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: TX_MID, textDecoration: 'none', flexShrink: 0,
                  }}>
                  <Icon size={13} />
                </a>
              ))}
            </div>

            {/* App store badges */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {['App Store', 'Google Play'].map(store => (
                <a key={store} href="#" style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7,
                  background: BORDER, border: `1px solid #252840`,
                  fontSize: 11, fontWeight: 600, color: TX_MID,
                  textDecoration: 'none',
                }}>
                  <ExternalLink size={10} />
                  {store}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Product
            </div>
            {PRODUCT_LINKS.map(link => (
              <div key={link} style={{ marginBottom: 10 }}>
                <a href="#" style={{ fontSize: 13, color: TX_MID, textDecoration: 'none', lineHeight: 1 }}>{link}</a>
              </div>
            ))}
          </div>

          {/* Company */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Company
            </div>
            {COMPANY_LINKS.map(link => (
              <div key={link} style={{ marginBottom: 10 }}>
                <a href="#" style={{ fontSize: 13, color: TX_MID, textDecoration: 'none' }}>{link}</a>
              </div>
            ))}
          </div>

          {/* Developers */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Developers
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#f47520', background: 'rgba(244,117,32,0.15)', padding: '1px 6px', borderRadius: 99, letterSpacing: '0.06em' }}>API</span>
            </div>
            <div style={{ marginBottom: 10 }}>
              <Link to="/developers" style={{ fontSize: 13, color: '#f47520', textDecoration: 'none', fontWeight: 600 }}>
                API Overview →
              </Link>
            </div>
            {DEVELOPER_LINKS.map(link => (
              <div key={link} style={{ marginBottom: 10 }}>
                <a href="/developers" style={{ fontSize: 13, color: TX_MID, textDecoration: 'none' }}>{link}</a>
              </div>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Legal
            </div>
            {LEGAL_LINKS.map(link => (
              <div key={link} style={{ marginBottom: 10 }}>
                {LEGAL_SLUGS[link]
                  ? <Link to={LEGAL_SLUGS[link]} style={{ fontSize: 13, color: TX_MID, textDecoration: 'none' }}>{link}</Link>
                  : <a href="#" style={{ fontSize: 13, color: TX_MID, textDecoration: 'none' }}>{link}</a>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: TX_DIM, lineHeight: 1.75, maxWidth: 900, margin: 0 }}>
            <span style={{ color: TX_MID, fontWeight: 600 }}>Disclaimer:</span> StockVision provides research
            tools and market data for educational purposes only. Nothing on this platform constitutes investment
            advice or a recommendation to buy or sell any security. All investments carry risk. Past performance
            is not indicative of future results. Please consult a SEBI-registered investment advisor before making
            any investment decisions. Market data is delayed by 15 minutes.
          </p>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: TX_DIM }}>
            <ShieldCheck size={12} color={TX_DIM} />
            <span>
              © {year} StockVision Technologies Pvt. Ltd. &nbsp;·&nbsp;
              CIN: U74999MH2024PTC000001 &nbsp;·&nbsp;
              SEBI RA: INH000000000
            </span>
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link to="/legal/privacy"    style={{ fontSize: 11.5, color: TX_DIM, textDecoration: 'none' }}>Privacy</Link>
            <Link to="/legal/terms"      style={{ fontSize: 11.5, color: TX_DIM, textDecoration: 'none' }}>Terms</Link>
            <a    href="#"               style={{ fontSize: 11.5, color: TX_DIM, textDecoration: 'none' }}>Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
