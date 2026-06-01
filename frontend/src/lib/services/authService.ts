/**
 * lib/services/authService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication — login, register, profile update.
 * Endpoint prefix: /auth
 */

import { requestJson, buildUserFromBackend } from '../core';
import type { BackendTokenResponse, BackendUser, RequestOptions } from '../core';
import type { AppUser } from '../../store/useStore';

export async function loginWithEmail(email: string, password: string) {
  const response = await requestJson<BackendTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return {
    token: response.access_token,
    user: buildUserFromBackend(response.user),
    onboardingComplete: response.user.onboarding_completed,
  };
}

export async function registerUser(name: string, email: string, password: string) {
  const response = await requestJson<BackendTokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  return {
    token: response.access_token,
    user: buildUserFromBackend(response.user),
    onboardingComplete: response.user.onboarding_completed,
  };
}

export async function updateProfile(
  token: string,
  patch: Partial<AppUser> & { onboardingCompleted?: boolean },
) {
  const response = await requestJson<BackendUser>('/auth/me', {
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
  } as RequestOptions);

  return buildUserFromBackend(response);
}
