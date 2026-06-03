import { useState, useEffect } from 'react';
import { Gift, Copy, Check, X, Users, IndianRupee } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { fetchReferralStats, type ReferralStats } from '../../lib/api';

interface Props { open: boolean; onClose: () => void; }

const MILESTONES = [
  { invites: 1, reward: '₹100',  label: 'First Invite',    done: true  },
  { invites: 3, reward: '₹300',  label: '3 Friends',       done: true  },
  { invites: 5, reward: '₹500 + 1 month Premium', label: '5 Friends', done: false },
  { invites: 10,reward: '₹1,500',label: 'Super Referrer',  done: false },
];

export default function ReferralModal({ open, onClose }: Props) {
  const { user, authToken } = useStore();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  // Pull live referral code, stats & milestones from /referrals/me when signed in
  useEffect(() => {
    if (!open || !authToken) return;
    let active = true;
    fetchReferralStats(authToken).then(s => { if (active && s) setStats(s); });
    return () => { active = false; };
  }, [open, authToken]);

  const code = stats?.code ?? `SV-${(user?.name ?? 'USER').toUpperCase().slice(0, 4)}-2026`;
  const link = `https://stockvision.in/join?ref=${code}`;
  const invited = stats?.invited ?? 3;
  const earned  = stats?.earnedInr ?? 400;
  const pending = stats?.pendingInr ?? 100;
  const milestones = stats?.milestones?.length
    ? stats.milestones.map(m => ({
        invites: m.target,
        reward:  m.reward,
        label:   `${m.target} Friend${m.target > 1 ? 's' : ''}`,
        done:    m.achieved,
      }))
    : MILESTONES;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 900 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 901, padding: 20, pointerEvents: 'none' }}>
            <div style={{
              width: '100%', maxWidth: 460,
              background: 'var(--bg-surface)',
              borderRadius: 18, border: '1px solid var(--border)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
              pointerEvents: 'all', overflow: 'hidden',
            }}>
              {/* Header gradient */}
              <div style={{ background: 'linear-gradient(135deg, rgba(244,117,32,0.18), rgba(167,139,250,0.12))', padding: '24px 24px 20px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}>
                  <X size={18} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(244,117,32,0.2)', border: '1px solid rgba(244,117,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Gift size={22} color="var(--brand)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx)' }}>Refer & Earn</div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx-3)' }}>Earn ₹100–₹1,500 per friend you invite</div>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Friends Invited', val: `${invited}`, icon: Users },
                    { label: 'Total Earned',    val: `₹${earned}`, icon: IndianRupee },
                    { label: 'Pending',         val: `₹${pending}`, icon: Gift },
                  ].map(({ label, val, icon: Icon }) => (
                    <div key={label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', marginBottom: 2 }}>{val}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '20px 24px 24px' }}>
                {/* Referral link */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Referral Link</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link}
                    </div>
                    <button
                      onClick={() => copy(link)}
                      style={{ padding: '10px 16px', borderRadius: 'var(--r-sm)', background: copied ? 'rgba(45,181,98,0.15)' : 'var(--brand)', border: 'none', color: copied ? 'var(--gain)' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'all 200ms' }}>
                      {copied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy</>}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Or share code:</span>
                    <button onClick={() => copy(code)} style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand)', background: 'rgba(244,117,32,0.1)', border: '1px solid rgba(244,117,32,0.3)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>{code}</button>
                  </div>
                </div>

                {/* Milestones */}
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reward Milestones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {milestones.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: m.done ? 'rgba(45,181,98,0.06)' : 'var(--bg-card)', border: `1px solid ${m.done ? 'rgba(45,181,98,0.2)' : 'var(--border)'}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: m.done ? 'rgba(45,181,98,0.15)' : 'var(--surface-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {m.done
                          ? <Check size={13} color="var(--gain)" />
                          : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)' }}>{m.invites}</span>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: m.done ? 'var(--tx)' : 'var(--tx-2)' }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{m.invites} friend{m.invites > 1 ? 's' : ''} sign up</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: m.done ? 'var(--gain)' : 'var(--brand)' }}>{m.reward}</div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 14, lineHeight: 1.6 }}>
                  Credits are added when your referral completes their first purchase. Terms & conditions apply.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
