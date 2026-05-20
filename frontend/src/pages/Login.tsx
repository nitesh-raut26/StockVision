import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart2, Phone, Mail, ArrowRight, Eye, EyeOff, ChartCandlestick, Target, Briefcase, Mic, FileText, Sun, Moon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { loginWithEmail } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useBreakpoint';

const features = [
  { icon: Target,           text: 'AI Conviction Score for 5,000+ stocks' },
  { icon: ChartCandlestick, text: 'DCF & Comparable Company Analysis' },
  { icon: Briefcase,        text: 'Multi-broker portfolio aggregation' },
  { icon: Mic,              text: 'Hindi AI audio summaries via Bhashini' },
  { icon: FileText,         text: 'CA-ready tax & P&L reports' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, completeOnboarding } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [tab, setTab]           = useState<'phone' | 'email'>('phone');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp]           = useState('');
  const [otpSent, setOtpSent]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await loginWithEmail(email || 'demo@stockvision.in', password || 'demo');
      login(response.user, response.token);
      if (response.onboardingComplete) {
        completeOnboarding();
        navigate('/app/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch {
      setError('Demo login unavailable right now. Please try again or use email login.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await loginWithEmail(email, password);
      login(response.user, response.token);
      if (response.onboardingComplete) {
        completeOnboarding();
        navigate('/app/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch {
      setError('Could not sign in with the backend right now. You can still explore the demo account below.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '12px 16px',
    color: 'var(--tx)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', position: 'relative' }}>

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--tx-2)', cursor: 'pointer' }}>
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Left panel — desktop only */}
      {!isMobile && <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        width: '48%', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', padding: 'clamp(32px,5vw,56px)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Brand bg orb */}
        <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(244,117,32,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 36, height: 36, background: 'var(--brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(244,117,32,0.4)' }}>
            <BarChart2 size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>StockVision</span>
        </div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 900, color: 'var(--tx)', marginBottom: 28, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
            Bloomberg Terminal for India's retail investor<br />
            <span className="gradient-text">at ₹299/month</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <f.icon size={16} color="var(--brand)" />
                </div>
                <span style={{ fontSize: 14, color: 'var(--tx-2)', fontWeight: 500, lineHeight: 1.4 }}>{f.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div style={{ fontSize: 12, color: 'var(--tx-3)', position: 'relative', zIndex: 1 }}>© 2026 StockVision · Made in India</div>
      </div>}

      {/* Right panel — login form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '24px 20px' : 'clamp(24px,5vw,48px)', minHeight: '100dvh' }}>
        <motion.div style={{ width: '100%', maxWidth: 420 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMobile ? 28 : 36, justifyContent: 'center' }}>
            <div style={{ width: 40, height: 40, background: 'var(--brand)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(244,117,32,0.4)' }}>
              <BarChart2 size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>StockVision</span>
          </div>

          <h1 style={{ fontSize: isMobile ? 26 : 28, fontWeight: 800, color: 'var(--tx)', marginBottom: 6, letterSpacing: '-0.025em', textAlign: isMobile ? 'center' : 'left' }}>Welcome back</h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)', marginBottom: 28, textAlign: isMobile ? 'center' : 'left' }}>Sign in to your account</p>

          {/* Google / Demo button */}
          <button onClick={handleDemoLogin} disabled={loading}
            style={{ width: '100%', background: '#fff', color: '#111827', borderRadius: 12, padding: '12px 0', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, border: '1px solid #e2e8f0', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'box-shadow 150ms' }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? 'Signing in…' : 'Explore Demo Account'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 500 }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, marginBottom: 22 }}>
            {(['phone', 'email'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', border: 'none', background: tab === t ? 'var(--brand)' : 'transparent', color: tab === t ? '#fff' : 'var(--tx-3)', fontFamily: 'inherit' }}>
                {t === 'phone' ? <Phone size={13} /> : <Mail size={13} />}
                {t === 'phone' ? 'Phone OTP' : 'Email'}
              </button>
            ))}
          </div>

          {tab === 'phone' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>Mobile Number</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...inputStyle, width: 'auto', padding: '12px 14px', color: 'var(--tx-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>+91</div>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" style={{ ...inputStyle }} />
                </div>
              </div>
              {!otpSent ? (
                <button onClick={() => { if (phone.length >= 10) setOtpSent(true); }}
                  style={{ width: '100%', background: 'var(--brand)', border: 'none', color: '#fff', padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'background 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}>
                  Send OTP <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>Enter OTP (use any 6 digits)</label>
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="• • • • • •" maxLength={6}
                      style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em', fontSize: 18 }} />
                  </div>
                  <button onClick={handleDemoLogin} disabled={loading || otp.length < 4}
                    style={{ width: '100%', background: 'var(--brand)', border: 'none', color: '#fff', padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: (loading || otp.length < 4) ? 0.55 : 1, fontFamily: 'inherit', transition: 'opacity 150ms' }}>
                    {loading ? 'Verifying…' : 'Verify & Enter Demo'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ ...inputStyle }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: 44 }} />
                  <button onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 150ms' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button onClick={handleEmailLogin} disabled={loading || !email || !password}
                style={{ width: '100%', background: 'var(--brand)', border: 'none', color: '#fff', padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit', transition: 'background 150ms, opacity 150ms' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--brand-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand)'; }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)', color: 'var(--loss)', fontSize: 12.5, lineHeight: 1.6 }}>
              {error}
            </div>
          )}

          <p style={{ fontSize: 12.5, color: 'var(--tx-3)', textAlign: 'center', marginTop: 28 }}>
            Don&rsquo;t have an account?{' '}
            <button onClick={() => navigate('/')} style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600 }}>
              Join the waitlist
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
