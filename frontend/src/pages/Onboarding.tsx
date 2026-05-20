import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, ChevronRight, CheckCircle, Sprout, TrendingUp, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { updateProfile } from '../lib/api';

const brokers = [
  { name: 'Zerodha',     color: '#387ED1' },
  { name: 'Groww',       color: '#00D09C' },
  { name: 'Upstox',      color: '#5367F4' },
  { name: 'Angel One',   color: '#E8523A' },
  { name: 'ICICI Direct',color: '#B4293D' },
];

const sectors = ['Defence', 'IT', 'Banking', 'FMCG', 'Auto', 'Pharma', 'Energy', 'Infrastructure', 'Metals', 'Real Estate'];

const styles = [
  { key: 'beginner',     label: 'Beginner',     icon: Sprout,     desc: 'Just started. I need guidance on what to buy.' },
  { key: 'intermediate', label: 'Intermediate', icon: TrendingUp, desc: '1–3 years experience. I understand fundamentals.' },
  { key: 'pro',          label: 'Pro Trader',   icon: Zap,        desc: 'Active trader. I need advanced tools.' },
];

const BTN_PRIMARY = {
  width: '100%', background: 'var(--brand)', border: 'none', color: '#fff', padding: '14px 0', borderRadius: 12,
  fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { authToken, completeOnboarding, updateUser } = useStore();
  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(['Defence', 'IT']);
  const [risk, setRisk] = useState(5);
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  const toggleBroker = (b: string) => setSelectedBrokers(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const toggleSector = (s: string) => setSelectedSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const handleFinish = async () => {
    const patch = {
      investingStyle: (selectedStyle || 'intermediate') as 'beginner' | 'intermediate' | 'pro',
      sectors: selectedSectors,
      riskAppetite: risk,
      language: lang,
    };

    updateUser(patch);
    completeOnboarding(patch);

    if (authToken) {
      try {
        await updateProfile(authToken, {
          ...patch,
          onboardingCompleted: true,
        });
      } catch {
        // Keep the flow usable even if the backend profile update is unavailable.
      }
    }

    navigate('/app/dashboard');
  };

  const riskLabel = risk <= 3 ? 'Conservative' : risk <= 6 ? 'Balanced' : 'Aggressive';
  const riskColor = risk <= 3 ? 'var(--gain)' : risk <= 6 ? 'var(--gold)' : 'var(--loss)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: 'var(--brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>StockVision</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: s <= step ? 'var(--brand)' : 'rgba(255,255,255,0.08)', transition: 'background 300ms' }} />
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 1: Investing style */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)', marginBottom: 6, letterSpacing: '-0.02em' }}>What&rsquo;s your investing style?</h1>
              <p style={{ fontSize: 13.5, color: 'var(--tx-3)', marginBottom: 24 }}>This personalises your AI conviction score weighting.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {styles.map(s => {
                  const Icon = s.icon;
                  const active = selectedStyle === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSelectedStyle(s.key)}
                      style={{ width: '100%', textAlign: 'left', padding: 18, borderRadius: 12, border: active ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: active ? 'var(--brand-dim)' : 'var(--bg-card)', cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 14 }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: active ? 'rgba(244,117,32,0.2)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={20} color={active ? 'var(--brand)' : 'var(--tx-3)'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--brand)' : 'var(--tx)', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>{s.desc}</div>
                      </div>
                      {active && <CheckCircle size={18} color="var(--brand)" style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(2)} disabled={!selectedStyle} style={{ ...BTN_PRIMARY, opacity: selectedStyle ? 1 : 0.4 }}>
                Continue <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* Step 2: Brokers */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)', marginBottom: 6, letterSpacing: '-0.02em' }}>Connect your brokers</h1>
              <p style={{ fontSize: 13.5, color: 'var(--tx-3)', marginBottom: 22 }}>Get a unified view of all your holdings. You can connect more later.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {brokers.map(b => {
                  const selected = selectedBrokers.includes(b.name);
                  return (
                    <button
                      key={b.name}
                      onClick={() => toggleBroker(b.name)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, border: selected ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: selected ? 'var(--brand-dim)' : 'var(--bg-card)', cursor: 'pointer', transition: 'all 150ms' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {b.name[0]}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: selected ? 'var(--brand)' : 'var(--tx)' }}>{b.name}</span>
                      </div>
                      {selected
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gain)', fontWeight: 600 }}><CheckCircle size={13} /> Connected</span>
                        : <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>OAuth connect</span>
                      }
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(3)} style={BTN_PRIMARY}>
                {selectedBrokers.length > 0 ? `Continue with ${selectedBrokers.length} broker${selectedBrokers.length > 1 ? 's' : ''}` : 'Skip for now'}
                <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)', marginBottom: 6, letterSpacing: '-0.02em' }}>Set your preferences</h1>
              <p style={{ fontSize: 13.5, color: 'var(--tx-3)', marginBottom: 22 }}>Personalise what you see on your dashboard.</p>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>Sectors of interest</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sectors.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSector(s)}
                      style={{ padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', border: selectedSectors.includes(s) ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: selectedSectors.includes(s) ? 'var(--brand-dim)' : 'transparent', color: selectedSectors.includes(s) ? 'var(--brand)' : 'var(--tx-3)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>Risk Appetite</div>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: riskColor }}>{riskLabel} ({risk}/10)</div>
                </div>
                <input type="range" min="1" max="10" value={risk} onChange={e => setRisk(+e.target.value)} style={{ width: '100%', accentColor: 'var(--brand)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx-3)', marginTop: 6 }}>
                  <span>Conservative</span><span>Aggressive</span>
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>Language preference</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['en', 'hi'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      style={{ flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', border: lang === l ? '1px solid var(--border-brand)' : '1px solid var(--border)', background: lang === l ? 'var(--brand-dim)' : 'var(--bg-card)', color: lang === l ? 'var(--brand)' : 'var(--tx-3)' }}
                    >
                      {l === 'en' ? 'English' : 'हिंदी'}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleFinish} style={{ ...BTN_PRIMARY, background: 'linear-gradient(135deg, var(--brand), var(--purple))' }}>
                Launch StockVision <ChevronRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={handleFinish} style={{ fontSize: 12.5, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
