import { Lock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';

type UserPlan = 'free' | 'premium' | 'pro' | 'enterprise';
type RequiredPlan = 'premium' | 'enterprise';

const PLAN_RANK: Record<UserPlan, number> = { free: 0, premium: 1, pro: 1, enterprise: 2 };
const REQUIRED_RANK: Record<RequiredPlan, number> = { premium: 1, enterprise: 2 };

interface PlanGateProps {
  requires: RequiredPlan;
  feature?: string;
  children: React.ReactNode;
  /** 'replace' fills page with a lock screen. 'overlay' blurs children and overlays a lock. */
  mode?: 'replace' | 'overlay';
}

export function usePlanAccess(requires: RequiredPlan): boolean {
  const { user } = useStore();
  const plan = (user?.plan ?? 'free') as UserPlan;
  return PLAN_RANK[plan] >= REQUIRED_RANK[requires];
}

export default function PlanGate({ requires, feature, children, mode = 'replace' }: PlanGateProps) {
  const navigate = useNavigate();
  const hasAccess = usePlanAccess(requires);

  if (hasAccess) return <>{children}</>;

  const badge = requires === 'enterprise' ? 'Enterprise' : 'Premium';
  const accentColor = requires === 'enterprise' ? '#a78bfa' : 'var(--brand)';

  if (mode === 'replace') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', padding: '60px 24px',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: `${accentColor === 'var(--brand)' ? 'rgba(244,117,32,0.12)' : 'rgba(167,139,250,0.12)'}`,
          border: `1px solid ${accentColor === 'var(--brand)' ? 'rgba(244,117,32,0.3)' : 'rgba(167,139,250,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={30} color={accentColor} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: accentColor, textTransform: 'uppercase' }}>
          {badge} Feature
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx)', margin: 0, letterSpacing: '-0.02em' }}>
          {feature ?? `${badge} Required`}
        </h2>

        <p style={{ fontSize: 14, color: 'var(--tx-3)', maxWidth: 360, lineHeight: 1.65, margin: 0 }}>
          Upgrade to <strong style={{ color: accentColor }}>{badge}</strong> to unlock{' '}
          {feature ? <><strong>{feature}</strong> and</> : null} all advanced research tools.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => navigate('/app/settings')}
            style={{
              background: accentColor, border: 'none', color: '#fff',
              padding: '12px 28px', borderRadius: 'var(--r-md)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <Zap size={15} />
            Upgrade to {badge}
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--tx-3)', padding: '12px 20px',
              borderRadius: 'var(--r-md)', fontSize: 14, cursor: 'pointer',
            }}>
            Go Back
          </button>
        </div>

        {/* Feature preview bullets */}
        <div style={{
          marginTop: 8, padding: '16px 24px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          maxWidth: 400, width: '100%',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What you get with {badge}
          </div>
          {(requires === 'premium'
            ? ['All screener filters', '5 AI research reports/month', 'DCF Builder', 'Family Portfolio (up to 3)', 'Auto tax import', 'Options Chain', 'Backtesting engine']
            : ['Everything in Premium', 'CA White-Label portal', 'Unlimited family members', 'Auto + CA export tax', 'API access', 'Unlimited AI research']
          ).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--tx-2)' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: `${accentColor === 'var(--brand)' ? 'rgba(244,117,32,0.15)' : 'rgba(167,139,250,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor }} />
              </div>
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // overlay mode — blur children and show lock badge on top
  return (
    <div style={{ position: 'relative', borderRadius: 'inherit' }}>
      <div style={{ filter: 'blur(3px) grayscale(0.4)', pointerEvents: 'none', opacity: 0.4 }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 10,
        background: 'rgba(0,0,0,0.28)', borderRadius: 'inherit',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `${accentColor === 'var(--brand)' ? 'rgba(244,117,32,0.2)' : 'rgba(167,139,250,0.2)'}`,
          border: `1px solid ${accentColor === 'var(--brand)' ? 'rgba(244,117,32,0.4)' : 'rgba(167,139,250,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={20} color={accentColor} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            {badge} Only
          </div>
          <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginBottom: 10 }}>
            {feature ?? 'Upgrade to unlock'}
          </div>
        </div>
        <button
          onClick={() => navigate('/app/settings')}
          style={{
            background: accentColor, border: 'none', color: '#fff',
            padding: '8px 20px', borderRadius: 'var(--r-sm)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <Zap size={12} />
          Upgrade
        </button>
      </div>
    </div>
  );
}
