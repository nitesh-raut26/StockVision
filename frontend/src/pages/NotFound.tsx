import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function NotFound() {
  const navigate   = useNavigate();
  const { isLoggedIn } = useStore();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,117,32,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '8%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 0.68, 0, 1.2] }}
        style={{ textAlign: 'center', maxWidth: 500, zIndex: 1 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}
        >
          <div style={{ width: 38, height: 38, background: 'var(--brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(244,117,32,0.4)' }}>
            <TrendingUp size={20} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.025em' }}>StockVision</span>
        </motion.div>

        {/* 404 number */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 0.68, 0, 1.2] }}
          style={{ position: 'relative', marginBottom: 8 }}
        >
          <span style={{
            fontSize: 'clamp(100px, 25vw, 160px)',
            fontWeight: 900,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, var(--brand) 0%, #f5a623 50%, rgba(244,117,32,0.3) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'block',
            userSelect: 'none',
          }}>404</span>
          {/* Glow under the number */}
          <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 200, height: 30, background: 'radial-gradient(ellipse, rgba(244,117,32,0.25) 0%, transparent 70%)', filter: 'blur(8px)' }} />
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 800, color: 'var(--tx)', marginBottom: 12, letterSpacing: '-0.02em' }}>
            Page not found
          </h1>
          <p style={{ fontSize: 15, color: 'var(--tx-3)', lineHeight: 1.65, marginBottom: 36, maxWidth: 380, margin: '0 auto 36px' }}>
            This URL doesn't exist in the StockVision platform. You may have followed a broken link or typed the address incorrectly.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.5 }}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(244,117,32,0.35)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(isLoggedIn ? '/app/dashboard' : '/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'var(--brand)', border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'box-shadow 200ms',
            }}
          >
            <Home size={16} />
            {isLoggedIn ? 'Go to Dashboard' : 'Back to Home'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--tx-2)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-brand)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <ArrowLeft size={16} />
            Go Back
          </motion.button>
        </motion.div>

        {/* Suggested links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ marginTop: 48, padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}
        >
          <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Quick Links</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[
              { label: 'Dashboard',     path: '/app/dashboard'   },
              { label: 'Stock Screener',path: '/app/screener'    },
              { label: 'Options Chain', path: '/app/options'     },
              { label: 'IPO Tracker',   path: '/app/ipo'         },
              { label: 'Backtesting',   path: '/app/backtest'    },
              { label: 'Mutual Funds',  path: '/app/mutual-funds'},
            ].map(link => (
              <button key={link.path}
                onClick={() => navigate(link.path)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-mid)', color: 'var(--tx-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 120ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-dim)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-brand)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-mid)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
              >
                {link.label}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
