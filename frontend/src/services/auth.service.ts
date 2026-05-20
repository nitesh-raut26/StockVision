import { requestJson } from './http';
import type { AppUser } from '../store/useStore';

interface BackendUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  language: string;
  investing_style: string | null;
  risk_appetite: number | null;
  sectors: string[];
  onboarding_completed: boolean;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: BackendUser;
}

function mapPlan(plan: string | null | undefined): AppUser['plan'] {
  if (plan === 'enterprise' || plan === 'pro' || plan === 'premium') return plan as AppUser['plan'];
  return 'free';
}

function buildUser(user: BackendUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    plan: mapPlan(user.plan),
    language: user.language === 'hi' ? 'hi' : 'en',
    investingStyle: user.investing_style === 'pro' ? 'pro' : user.investing_style === 'beginner' ? 'beginner' : 'intermediate',
    riskAppetite: user.risk_appetite ?? 5,
    sectors: user.sectors ?? [],
  };
}

export async function loginWithEmail(email: string, password: string) {
  const res = await requestJson<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return { token: res.access_token, user: buildUser(res.user), onboardingComplete: res.user.onboarding_completed };
}

export async function updateProfile(token: string, patch: Partial<AppUser> & { onboardingCompleted?: boolean }) {
  const res = await requestJson<BackendUser>('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: patch.name,
      language: patch.language,
      investing_style: patch.investingStyle,
      risk_appetite: patch.riskAppetite,
      sectors: patch.sectors,
      onboarding_completed: patch.onboardingCompleted,
    }),
  });
  return buildUser(res);
}
