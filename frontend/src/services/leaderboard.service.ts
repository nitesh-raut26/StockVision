import { requestJson } from './http';

export async function fetchLeaderboard(token: string) {
  return requestJson<Array<{
    rank: number; display_name: string;
    returns_pct: number; portfolio_value: number; is_user: boolean;
  }>>('/leaderboard/', { token });
}
