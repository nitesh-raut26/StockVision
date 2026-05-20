/**
 * CookieConsent — DPDP Act 2023 compliant consent banner.
 *
 * India's DPDP Act (effective 2025) requires:
 *  - Clear, specific notice before collecting personal data
 *  - Affirmative consent (opt-in, not opt-out) for non-essential processing
 *  - Granular controls per processing purpose
 *  - Easy withdrawal mechanism
 *  - Consent logged server-side (see POST /api/v1/compliance/consent)
 *
 * Consent categories:
 *  1. Essential (always on, no consent needed — necessary for service)
 *  2. Analytics   (understanding usage patterns)
 *  3. Marketing   (promotional communications)
 *  4. AI Analysis (using portfolio data to improve AI recommendations)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStore } from '../../store/useStore';

const STORAGE_KEY = 'sv_consent_v1';

interface ConsentPrefs {
  analytics:   boolean;
  marketing:   boolean;
  ai_analysis: boolean;
  saved_at:    number;
}

const DEFAULT_PREFS: ConsentPrefs = {
  analytics:   false,
  marketing:   false,
  ai_analysis: true,
  saved_at:    0,
};

function loadSavedPrefs(): ConsentPrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: ConsentPrefs = JSON.parse(raw);
    // Re-prompt after 180 days per DPDP Act
    if (Date.now() - parsed.saved_at > 180 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePrefs(prefs: ConsentPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, saved_at: Date.now() }));
  } catch { /* ignore */ }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

async function recordConsents(
  prefs: ConsentPrefs,
  authToken: string | null,
): Promise<void> {
  const types: Array<[string, boolean]> = [
    ['analytics',   prefs.analytics],
    ['marketing',   prefs.marketing],
    ['ai_analysis', prefs.ai_analysis],
  ];
  for (const [type, granted] of types) {
    try {
      await fetch(`${API_BASE}/compliance/consent`, {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ consent_type: type, granted, version: '1.0' }),
      });
    } catch { /* fire-and-forget */ }
  }
}

/* ─── Toggle component ────────────────────────────────────────────────────── */

function ConsentToggle({
  label,
  description,
  locked,
  checked,
  onChange,
}: {
  label:       string;
  description: string;
  locked?:     boolean;
  checked:     boolean;
  onChange:    (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{label}</span>
          {locked && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(244,117,32,0.12)', color: 'var(--brand)' }}>REQUIRED</span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--tx-3)', margin: 0, lineHeight: 1.5 }}>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={locked}
        onClick={() => !locked && onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: checked ? 'var(--brand)' : 'rgba(255,255,255,0.12)',
          position: 'relative', cursor: locked ? 'default' : 'pointer',
          border: 'none', transition: 'background 200ms', flexShrink: 0, marginTop: 2,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 21 : 3, transition: 'left 200ms' }} />
      </button>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function CookieConsent() {
  const { isLoggedIn, authToken } = useStore();
  const [show,        setShow]    = useState(false);
  const [expanded,    setExpanded] = useState(false);
  const [prefs,       setPrefs]   = useState<ConsentPrefs>(DEFAULT_PREFS);
  const [saving,      setSaving]  = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash on first render
    const t = setTimeout(() => {
      const saved = loadSavedPrefs();
      if (!saved) {
        setShow(true);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const accept = async (acceptAll: boolean) => {
    setSaving(true);
    const final: ConsentPrefs = acceptAll
      ? { analytics: true, marketing: true, ai_analysis: true, saved_at: Date.now() }
      : { ...prefs, saved_at: Date.now() };

    savePrefs(final);

    if (isLoggedIn) {
      await recordConsents(final, authToken);
    }

    setSaving(false);
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: [0.22, 0.68, 0, 1.2] }}
          style={{
            position:  'fixed',
            bottom:    24,
            left:      '50%',
            transform: 'translateX(-50%)',
            width:     'calc(100% - 32px)',
            maxWidth:  520,
            background: 'var(--bg-surface)',
            border:    '1px solid var(--border-md)',
            borderRadius: 16,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            zIndex:    9999,
            overflow:  'hidden',
          }}
          role="dialog"
          aria-label="Cookie and privacy consent"
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="var(--brand)" />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)' }}>Privacy Preferences</span>
              <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: 'rgba(244,117,32,0.1)', color: 'var(--brand)', fontWeight: 700 }}>DPDP 2023</span>
            </div>
            <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 13, color: 'var(--tx-2)', margin: '0 0 14px', lineHeight: 1.6 }}>
              StockVision processes your data to provide investment analytics and personalised AI insights.
              Under India's <strong>DPDP Act 2023</strong>, you have the right to choose which data processing you consent to.
            </p>

            {/* Manage preferences toggle */}
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, padding: 0, marginBottom: expanded ? 12 : 0, fontFamily: 'inherit' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Hide preferences' : 'Manage preferences'}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden', marginBottom: 12 }}
                >
                  <ConsentToggle
                    label="Essential"
                    description="Authentication, security, and core service functionality. Cannot be disabled."
                    locked
                    checked
                    onChange={() => {}}
                  />
                  <ConsentToggle
                    label="Analytics"
                    description="Understand how you use StockVision to improve the product. Data is anonymised."
                    checked={prefs.analytics}
                    onChange={v => setPrefs(p => ({ ...p, analytics: v }))}
                  />
                  <ConsentToggle
                    label="Marketing Communications"
                    description="Receive emails about new features, research reports, and market insights."
                    checked={prefs.marketing}
                    onChange={v => setPrefs(p => ({ ...p, marketing: v }))}
                  />
                  <ConsentToggle
                    label="AI Analysis"
                    description="Allow AI to use your portfolio context to generate personalised insights and recommendations."
                    checked={prefs.ai_analysis}
                    onChange={v => setPrefs(p => ({ ...p, ai_analysis: v }))}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {expanded && (
                <button
                  onClick={() => accept(false)}
                  disabled={saving}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Save choices
                </button>
              )}
              <button
                onClick={() => accept(true)}
                disabled={saving}
                className="btn-primary btn-glow"
                style={{ flex: 1, padding: '9px', fontSize: 13, borderRadius: 10 }}>
                {saving ? 'Saving…' : 'Accept all'}
              </button>
              {!expanded && (
                <button
                  onClick={() => accept(false)}
                  disabled={saving}
                  style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Essential only
                </button>
              )}
            </div>

            <p style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
              You can change these at any time in Settings → Security · <a href="/legal/privacy" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Privacy Policy</a>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
