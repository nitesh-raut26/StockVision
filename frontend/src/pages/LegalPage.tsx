import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { LEGAL_SLUGS } from '../data/legalSlugs';

/* ── Document registry ──────────────────────────────────────────── */
const DOCS: Record<string, { title: string; lastUpdated: string; sections: { heading: string; body: string }[] }> = {

  privacy: {
    title: 'Privacy Policy',
    lastUpdated: '15 May 2026',
    sections: [
      {
        heading: '1. Introduction',
        body: `StockVision Technologies Pvt. Ltd. ("StockVision", "we", "our", "us") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at stockvision.in and our mobile applications (collectively, the "Platform").

Please read this policy carefully. By accessing or using our Platform, you acknowledge that you have read and understood this Privacy Policy.`,
      },
      {
        heading: '2. Information We Collect',
        body: `We collect information you provide directly to us, including:

• **Account Information**: Name, email address, phone number, and password when you create an account.
• **Profile Data**: Investment style, risk appetite, sector preferences, and onboarding responses.
• **Broker Credentials (OAuth tokens only)**: When you connect a broker account (Zerodha, Groww, Angel One, etc.), we receive read-only OAuth access tokens. We never store your broker login credentials or passwords.
• **Transaction Data**: Trade records you add manually or import via broker API.
• **Usage Data**: Pages visited, features used, search queries, click patterns, and session duration.
• **Device Information**: IP address, browser type, operating system, device identifiers.
• **Communication Data**: Emails and messages you send to our support team.`,
      },
      {
        heading: '3. How We Use Your Information',
        body: `We use the information we collect to:

• Provide, operate, and maintain the Platform and its features.
• Personalise your experience — AI research signals, screener recommendations, and watchlist alerts.
• Process transactions and send subscription-related notifications.
• Send price alerts, portfolio notifications, and product updates you have opted into.
• Detect and prevent fraud, abuse, and security incidents.
• Comply with legal obligations including SEBI reporting requirements.
• Improve our algorithms, models, and product features through anonymised, aggregated analysis.`,
      },
      {
        heading: '4. Data Sharing and Disclosure',
        body: `We do not sell your personal data. We may share information only in these circumstances:

• **Service Providers**: Third-party vendors (e.g., AWS for hosting, Stripe for payments, SendGrid for email) who process data on our behalf under confidentiality agreements.
• **Broker APIs**: Data exchanged with connected brokers is governed by the respective broker's terms.
• **Legal Requirements**: When required by law, court order, or regulatory authority (including SEBI, IRDAI, or law enforcement).
• **Business Transfers**: In connection with a merger, acquisition, or sale of assets, with prior notice to users.`,
      },
      {
        heading: '5. Data Retention',
        body: `We retain your personal data for as long as your account is active or as necessary to provide services. Upon account deletion, we delete or anonymise personal data within 30 days, except where retention is required by law (e.g., financial records under the Companies Act, 2013 must be retained for 8 years).`,
      },
      {
        heading: '6. Security',
        body: `We implement industry-standard security measures including AES-256 encryption at rest, TLS 1.3 in transit, JWT-based authentication, rate limiting, and regular penetration testing. However, no system is completely secure. You are responsible for keeping your login credentials confidential.`,
      },
      {
        heading: '7. Your Rights',
        body: `Under the Digital Personal Data Protection Act, 2023 (DPDPA) you have the right to:

• Access your personal data we hold.
• Correct inaccurate or incomplete data.
• Erase your data ("right to be forgotten"), subject to legal retention obligations.
• Nominate a representative for data access in case of death or incapacity.
• Withdraw consent for non-essential processing.

To exercise these rights, email us at privacy@stockvision.in.`,
      },
      {
        heading: '8. Cookies',
        body: `We use essential cookies for authentication and session management, and optional analytics cookies (with your consent) to understand usage patterns. See our Cookie Policy for details. You can manage cookie preferences in your browser settings.`,
      },
      {
        heading: '9. Changes to This Policy',
        body: `We may update this policy periodically. We will notify you of material changes via email or an in-app notification at least 14 days before changes take effect. Continued use after the effective date constitutes acceptance.`,
      },
      {
        heading: '10. Contact Us',
        body: `For privacy-related queries or grievances, contact our Data Protection Officer:

StockVision Technologies Pvt. Ltd.
Email: privacy@stockvision.in
Address: 101, Tech Park, Powai, Mumbai – 400 076, Maharashtra, India
Grievance Redressal Response Time: 30 days`,
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    lastUpdated: '15 May 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: `By accessing or using the StockVision platform, website, or mobile application ("Platform"), you agree to be bound by these Terms of Service ("Terms"), our Privacy Policy, and our Disclaimer. If you do not agree to these Terms, do not use the Platform.

These Terms constitute a legally binding agreement between you and StockVision Technologies Pvt. Ltd. (CIN: U74999MH2024PTC000001).`,
      },
      {
        heading: '2. Eligibility',
        body: `To use the Platform you must:

• Be at least 18 years of age.
• Be a resident of India or otherwise permitted to use the Platform under applicable laws.
• Not be barred from using financial services under any court order or regulatory action.
• Have a valid PAN card for broker account linking.`,
      },
      {
        heading: '3. Account Registration',
        body: `You are responsible for maintaining the confidentiality of your account credentials. You agree to:

• Provide accurate, current, and complete registration information.
• Promptly update information if it changes.
• Notify us immediately at support@stockvision.in of any unauthorised access to your account.
• Accept responsibility for all activity that occurs under your account.

We reserve the right to suspend or terminate accounts that violate these Terms.`,
      },
      {
        heading: '4. Permitted Use',
        body: `You may use the Platform solely for lawful, personal, non-commercial research and portfolio tracking purposes. You agree not to:

• Reproduce, redistribute, sell, or create derivative works from Platform content.
• Use automated tools, bots, scrapers, or crawlers to extract data.
• Reverse-engineer any part of the Platform.
• Attempt to gain unauthorised access to our systems.
• Use the Platform to facilitate insider trading or market manipulation.
• Transmit malware, viruses, or any harmful code.`,
      },
      {
        heading: '5. Subscriptions and Payments',
        body: `Certain features require a paid subscription (Free, Premium ₹299/month, Enterprise ₹1,999/month).

• Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date.
• Payments are processed securely via Stripe. We do not store card details.
• Refunds are available within 7 days of initial purchase if the service was materially defective.
• Price changes will be communicated with 30 days' notice.`,
      },
      {
        heading: '6. Intellectual Property',
        body: `All content on the Platform — including the AI Conviction Score algorithm, UI design, data visualisations, and written research — is owned by or licensed to StockVision Technologies Pvt. Ltd. and is protected by Indian copyright, trademark, and trade-secret laws.

You retain ownership of any personal portfolio data you upload. By uploading, you grant us a limited licence to process it to provide the service.`,
      },
      {
        heading: '7. Third-Party Services',
        body: `The Platform integrates with third-party broker APIs (Zerodha, Groww, Angel One, etc.) and data providers. We are not responsible for the availability, accuracy, or actions of these third parties. Your use of broker integrations is also subject to those brokers' terms of service.`,
      },
      {
        heading: '8. Disclaimer of Warranties',
        body: `The Platform is provided "AS IS" and "AS AVAILABLE" without warranty of any kind. We do not warrant that:

• The Platform will be uninterrupted, timely, or error-free.
• Market data is real-time or free from errors (data is delayed by up to 15 minutes).
• AI-generated research signals will be accurate or profitable.`,
      },
      {
        heading: '9. Limitation of Liability',
        body: `To the maximum extent permitted by law, StockVision and its directors, employees, and agents shall not be liable for:

• Any trading losses or investment decisions made based on Platform content.
• Indirect, incidental, special, or consequential damages.
• Loss of data, profits, goodwill, or business opportunity.

Our total liability in any calendar year shall not exceed the subscription fees you paid to us in that year.`,
      },
      {
        heading: '10. Governing Law and Dispute Resolution',
        body: `These Terms are governed by the laws of India. Disputes shall first be attempted to be resolved through good-faith negotiation within 30 days. Unresolved disputes shall be submitted to binding arbitration under the Arbitration and Conciliation Act, 1996, with a sole arbitrator appointed by mutual agreement. The seat of arbitration shall be Mumbai, Maharashtra.`,
      },
      {
        heading: '11. Modifications',
        body: `We reserve the right to modify these Terms at any time. Material changes will be communicated via email or in-app notification with at least 14 days' prior notice. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.`,
      },
      {
        heading: '12. Contact',
        body: `For questions about these Terms:
Email: legal@stockvision.in
Address: 101, Tech Park, Powai, Mumbai – 400 076, Maharashtra, India`,
      },
    ],
  },

  disclaimer: {
    title: 'Disclaimer',
    lastUpdated: '15 May 2026',
    sections: [
      {
        heading: 'Not Investment Advice',
        body: `StockVision Technologies Pvt. Ltd. is registered with SEBI as a Research Analyst (Registration No. INH000000000). The content, tools, AI signals, DCF models, screener outputs, research reports, and any other information provided on this Platform are for educational and informational purposes only.

Nothing on this Platform constitutes:
• Investment advice or a recommendation to buy, sell, or hold any security.
• A solicitation or offer to buy or sell securities.
• Financial planning, tax advice, or legal advice.

You should independently verify all information and consult a SEBI-registered investment advisor before making any investment decisions.`,
      },
      {
        heading: 'AI Conviction Scores',
        body: `Our proprietary AI Conviction Score is a quantitative model that analyses 40+ publicly available data points. It is an algorithmic output — not a human analyst recommendation. Past conviction scores have no bearing on future performance. The score may be incorrect, delayed, or based on stale data.`,
      },
      {
        heading: 'Market Data',
        body: `Market data displayed on this Platform (stock prices, indices, volumes) is sourced from NSE/BSE data feeds and may be delayed by up to 15 minutes. We do not guarantee the accuracy, completeness, or timeliness of this data. Do not make trading decisions based solely on data from this Platform.`,
      },
      {
        heading: 'Past Performance',
        body: `Past performance of any stock, strategy, or backtest result shown on the Platform is not indicative of future results. Backtesting results are hypothetical and do not reflect actual trading. Actual results may differ materially due to transaction costs, slippage, liquidity constraints, and other factors.`,
      },
      {
        heading: 'Risk Warning',
        body: `Investing in securities markets involves substantial risk of loss. The value of investments can fall as well as rise. You may lose some or all of the money you invest. Derivatives (options, futures) carry additional risk, including the potential to lose more than the initial investment.

This Platform is not suitable for investors who cannot afford to sustain losses.`,
      },
      {
        heading: 'SEBI Disclosure',
        body: `StockVision Technologies Pvt. Ltd. and its associates, directors, and employees may hold positions in securities mentioned on this Platform. Any such positions are disclosed where required by SEBI regulations. We do not receive any compensation from companies for coverage.`,
      },
    ],
  },

  cookies: {
    title: 'Cookie Policy',
    lastUpdated: '15 May 2026',
    sections: [
      {
        heading: '1. What Are Cookies',
        body: `Cookies are small text files placed on your device by a website. They allow the website to remember your preferences and actions over time. We also use similar technologies such as local storage (for authentication tokens) and session storage.`,
      },
      {
        heading: '2. Cookies We Use',
        body: `**Essential Cookies (Always Active)**
These are necessary for the Platform to function and cannot be switched off:
• Authentication session cookie — keeps you logged in securely.
• CSRF protection token — prevents cross-site request forgery attacks.
• Load balancer cookie — routes requests consistently within a session.

**Analytics Cookies (Optional — Consent Required)**
Used to understand how users interact with the Platform:
• Page views and navigation paths (anonymised).
• Feature usage frequency.
• Error and performance monitoring.

We use privacy-respecting analytics and do not share this data with ad networks.

**No Advertising Cookies**
We do not use tracking cookies for advertising, remarketing, or cross-site tracking.`,
      },
      {
        heading: '3. Managing Cookies',
        body: `You can control cookies through your browser settings. Note that disabling essential cookies will prevent you from logging in. For Chrome, Firefox, Safari, and Edge, visit the browser's Help section for instructions on managing cookies.

You may also opt out of analytics cookies at any time from your Account Settings.`,
      },
      {
        heading: '4. Third-Party Cookies',
        body: `Our payment processor (Stripe) and authentication services may set cookies on your device. These are governed by their respective privacy policies. We do not control these cookies.`,
      },
      {
        heading: '5. Updates',
        body: `We may update this Cookie Policy as we add new features or change service providers. The "Last Updated" date at the top will reflect any changes. We will notify you of material changes via in-app notification.`,
      },
    ],
  },

  sebi: {
    title: 'SEBI Disclosure',
    lastUpdated: '15 May 2026',
    sections: [
      {
        heading: 'Research Analyst Registration',
        body: `StockVision Technologies Pvt. Ltd. is registered with the Securities and Exchange Board of India (SEBI) as a Research Analyst under the SEBI (Research Analysts) Regulations, 2014.

Registration Number: INH000000000
Registration Date: 1 January 2025
Validity: Perpetual (subject to renewal every 3 years)
Principal Regulator: SEBI, BKC, Mumbai`,
      },
      {
        heading: 'Conflict of Interest Disclosure',
        body: `StockVision Technologies Pvt. Ltd., its associates, directors, and research team members:

• May hold positions (long or short) in securities that are the subject of research reports. Material holdings (>1% of issued share capital) are disclosed in the relevant report.
• Do not receive commission or compensation from any company for initiating or maintaining coverage of their securities.
• Do not have any material conflict of interest at the time of publication of research reports, to the best of our knowledge.
• All research reports undergo a conflicts-of-interest review before publication.`,
      },
      {
        heading: 'SEBI Investor Charter',
        body: `As a SEBI-registered Research Analyst, we are required to display the SEBI Investor Charter. The charter is available at: https://www.sebi.gov.in/investor-charter.

**Rights of Investors:**
• Receive research reports free of errors and prepared honestly.
• Lodge complaints against Research Analysts with SEBI.

**Grievance Redressal:**
In case of any grievance, investors may:
1. Contact us at: grievance@stockvision.in (Response within 30 days)
2. Escalate to SEBI via SCORES: https://scores.sebi.gov.in
3. Use SEBI's ODR portal: https://smartodr.in`,
      },
      {
        heading: 'Regulatory Filings',
        body: `We maintain and file all required reports with SEBI including:
• Half-yearly reports on research activities.
• Annual compliance reports.
• Disclosure of conflict of interest in research reports.

All SEBI filings are up to date as of the Last Updated date on this page.`,
      },
      {
        heading: 'Disclaimer (Regulatory)',
        body: `Research reports and AI-generated signals are based on publicly available information. StockVision Technologies Pvt. Ltd. does not guarantee the accuracy or completeness of data used. The research is not a solicitation to trade. Investment in securities is subject to market risks. SEBI registration does not guarantee the quality of research or the performance of any recommended securities.

"Investment in securities market are subject to market risks, read all the related documents carefully before investing."`,
      },
    ],
  },
};

// Re-exported from shared location so Footer doesn't statically pull this page into the main chunk
export { LEGAL_SLUGS } from '../data/legalSlugs';

/* ── Component ──────────────────────────────────────────────────── */
export default function LegalPage() {
  const { slug = 'privacy' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const doc = DOCS[slug];

  if (!doc) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <div style={{ fontSize: 48, fontWeight: 900 }}>404</div>
        <div style={{ fontSize: 16, color: 'var(--tx-3)' }}>Document not found.</div>
        <button onClick={() => navigate('/')} style={{ padding: '10px 24px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'inherit' }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', zIndex: 50, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
            <ArrowLeft size={15} />
            Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: '#f47520', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="9.5" width="3" height="5" rx="0.8" fill="white" />
                <rect x="6.5" y="6" width="3" height="8.5" rx="0.8" fill="white" />
                <rect x="11.5" y="1.5" width="3" height="13" rx="0.8" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.01em' }}>StockVision</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Document header */}
        <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ShieldCheck size={20} color="var(--brand)" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Legal</span>
          </div>
          <h1 style={{ fontSize: 'clamp(26px,5vw,38px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--tx)', marginBottom: 10 }}>
            {doc.title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>Last updated: {doc.lastUpdated}</p>
        </div>

        {/* Other legal docs quick links */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 36 }}>
          {Object.entries(LEGAL_SLUGS).map(([label, path]) => {
            const isActive = path === `/legal/${slug}`;
            return (
              <Link
                key={label}
                to={path}
                style={{
                  fontSize: 12, padding: '5px 13px', borderRadius: 99,
                  border: `1px solid ${isActive ? 'rgba(244,117,32,0.5)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(244,117,32,0.1)' : 'transparent',
                  color: isActive ? 'var(--brand)' : 'var(--tx-3)',
                  textDecoration: 'none', fontWeight: isActive ? 700 : 400,
                  transition: 'all 150ms',
                }}>
                {label}
              </Link>
            );
          })}
        </div>

        {/* Document body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {doc.sections.map((section, i) => (
            <div key={i}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                {section.heading}
              </h2>
              <div style={{ fontSize: 14, color: 'var(--tx-2)', lineHeight: 1.8 }}>
                {section.body.split('\n').map((line, j) => {
                  if (!line.trim()) return <br key={j} />;
                  // Bold **text**
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p key={j} style={{ margin: '0 0 6px', lineHeight: 1.8 }}>
                      {parts.map((part, k) =>
                        k % 2 === 1
                          ? <strong key={k} style={{ color: 'var(--tx)', fontWeight: 700 }}>{part}</strong>
                          : part
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
            © 2026 StockVision Technologies Pvt. Ltd. · CIN: U74999MH2024PTC000001
          </span>
          <button
            onClick={() => navigate('/')}
            style={{ fontSize: 12.5, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
