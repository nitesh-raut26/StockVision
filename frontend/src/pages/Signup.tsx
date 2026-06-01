import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Eye, EyeOff, User, Mail, Lock,
  CheckCircle2, XCircle, Sun, Moon, ArrowRight,
  TrendingUp, Shield, Zap,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { registerUser } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useBreakpoint';

/* ── Password strength helpers ─────────────────────────────────────────────── */
interface StrengthRule {
  label: string;
  test: (p: string) => boolean;
}

const rules: StrengthRule[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p) => /[A-Z]/.test(p) },
  { label: 'One number',            test: (p) => /\d/.test(p) },
  { label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string): number {
  return rules.filter((r) => r.test(password)).length;
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

/* ── Perks shown on the left panel ─────────────────────────────────────────── */
const perks = [
  { icon: TrendingUp, title: 'AI Conviction Scores',  desc: 'Proprietary scoring for 5,000+ Indian stocks' },
  { icon: Shield,     title: 'Bank-Grade Security',   desc: 'End-to-end encryption & httpOnly cookies' },
  { icon: Zap,        title: 'Real-Time Alerts',      desc: 'Price, volume & fundamental triggers' },
];

export default function Signup() {
  const navigate   = useNavigate();
  const { login, completeOnboarding } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isMobile   = useIsMobile();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [touched,  setTouched]  = useState({ name: false, email: false, password: false, confirm: false });

  const strength    = getStrength(password);
  const emailValid  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit   = name.trim().length >= 2 && emailValid && strength >= 2 && passwordsMatch && !loading;

  const markTouched = (field: keyof typeof touched) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const response = await registerUser(name.trim(), email, password);
      login(response.user, response.token);
      if (response.onboardingComplete) {
        completeOnboarding();
        navigate('/app/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('409') || message.toLowerCase().includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError('Could not create your account right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Input style ─────────────────────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1.5px solid var(--border)',
    borderRadius: 12,
    padding: '12px 16px 12px 42px',
    color: 'var(--tx)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 150ms',
  };

  const fieldWrapper: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--tx-3)',
    pointerEvents: 'none',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', position: 'relative' }}>

      {/* Theme toggle */}
      <button
        id="theme-toggle-signup"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--r-md)', background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--tx-2)', cursor: 'pointer',
        }}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* ── Left panel (desktop only) ───────────────────────────────────────── */}
      {!isMobile && (
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          width: '46%', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
          padding: 'clamp(32px,5vw,56px)', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: -100, left: -100, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(244,117,32,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 36, height: 36, background: 'var(--brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(244,117,32,0.4)' }}>
              <BarChart2 size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>StockVision</span>
          </div>

          {/* Headline + perks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <h2 style={{ fontSize: 'clamp(22px,2.8vw,32px)', fontWeight: 900, color: 'var(--tx)', marginBottom: 10, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
              India's smartest stock{' '}
              <span className="gradient-text">intelligence platform.</span>
            </h2>
            <p style={{ fontSize: 14, color: 'var(--tx-3)', marginBottom: 36, lineHeight: 1.7 }}>
              Join 50,000+ investors who trust StockVision for research-grade insights — free for the first 30 days.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {perks.map((perk, i) => (
                <motion.div
                  key={perk.title}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.1 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}
                >
                  <div style={{ width: 38, height: 38, background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <perk.icon size={17} color="var(--brand)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{perk.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.5 }}>{perk.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div style={{ fontSize: 12, color: 'var(--tx-3)', position: 'relative', zIndex: 1 }}>
            © 2026 StockVision · Made in India · Free for 30 days
          </div>
        </div>
      )}

      {/* ── Right panel — signup form ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '24px 20px' : 'clamp(24px,5vw,48px)',
        minHeight: '100dvh', overflowY: 'auto',
      }}>
        <motion.div
          style={{ width: '100%', maxWidth: 440 }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        >
          {/* Mobile logo */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
              <div style={{ width: 40, height: 40, background: 'var(--brand)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(244,117,32,0.4)' }}>
                <BarChart2 size={20} color="#fff" />
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>StockVision</span>
            </div>
          )}

          <h1 style={{ fontSize: isMobile ? 26 : 28, fontWeight: 800, color: 'var(--tx)', marginBottom: 4, letterSpacing: '-0.025em', textAlign: isMobile ? 'center' : 'left' }}>
            Create your account
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--tx-3)', marginBottom: 28, textAlign: isMobile ? 'center' : 'left' }}>
            Free for 30 days · No credit card required
          </p>

          <form id="signup-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>
                Full Name
              </label>
              <div style={fieldWrapper}>
                <User size={15} style={iconStyle} />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched('name')}
                  placeholder="Rahul Sharma"
                  style={{
                    ...inputStyle,
                    borderColor: touched.name && name.trim().length < 2 ? 'var(--loss)' : 'var(--border)',
                  }}
                />
              </div>
              {touched.name && name.trim().length < 2 && (
                <p style={{ fontSize: 11.5, color: 'var(--loss)', marginTop: 5 }}>Enter at least 2 characters</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>
                Email Address
              </label>
              <div style={fieldWrapper}>
                <Mail size={15} style={iconStyle} />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched('email')}
                  placeholder="you@example.com"
                  style={{
                    ...inputStyle,
                    borderColor: touched.email && !emailValid ? 'var(--loss)' : 'var(--border)',
                  }}
                />
              </div>
              {touched.email && !emailValid && (
                <p style={{ fontSize: 11.5, color: 'var(--loss)', marginTop: 5 }}>Enter a valid email address</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={iconStyle} />
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  placeholder="Create a strong password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: level <= strength ? strengthColor[strength] : 'var(--border)',
                        transition: 'background 250ms',
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor[strength] }}>
                      {strengthLabel[strength]}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                      {rules.map((rule) => (
                        <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {rule.test(password)
                            ? <CheckCircle2 size={10} color="#22c55e" />
                            : <XCircle size={10} color="var(--tx-4, #9ca3af)" />
                          }
                          <span style={{ fontSize: 10.5, color: rule.test(password) ? '#22c55e' : 'var(--tx-3)' }}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 7 }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={iconStyle} />
                <input
                  id="signup-confirm"
                  type={showConf ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => markTouched('confirm')}
                  placeholder="Re-enter your password"
                  style={{
                    ...inputStyle,
                    paddingRight: 44,
                    borderColor: touched.confirm && confirm.length > 0 && !passwordsMatch ? 'var(--loss)' : 'var(--border)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConf(!showConf)}
                  aria-label={showConf ? 'Hide confirm password' : 'Show confirm password'}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {touched.confirm && confirm.length > 0 && !passwordsMatch && (
                <p style={{ fontSize: 11.5, color: 'var(--loss)', marginTop: 5 }}>Passwords do not match</p>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)', color: 'var(--loss)', fontSize: 12.5, lineHeight: 1.6 }}
                >
                  {error}
                  {error.includes('already registered') && (
                    <> {' '}<Link to="/login" style={{ color: 'var(--brand)', fontWeight: 600 }}>Sign in</Link></>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%', background: 'var(--brand)', border: 'none', color: '#fff',
                padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5, fontFamily: 'inherit',
                transition: 'background 150ms, opacity 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = 'var(--brand-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; }}
            >
              {loading ? 'Creating account…' : (
                <>Create Account <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* T&C */}
          <p style={{ fontSize: 11.5, color: 'var(--tx-3)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
            By signing up you agree to our{' '}
            <Link to="/legal/terms" style={{ color: 'var(--brand)', fontWeight: 500 }}>Terms</Link>
            {' '}and{' '}
            <Link to="/legal/privacy" style={{ color: 'var(--brand)', fontWeight: 500 }}>Privacy Policy</Link>.
          </p>

          {/* Sign in link */}
          <p style={{ fontSize: 13, color: 'var(--tx-3)', textAlign: 'center', marginTop: 22 }}>
            Already have an account?{' '}
            <Link
              to="/login"
              id="goto-login"
              style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
