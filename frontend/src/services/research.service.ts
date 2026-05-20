import { requestJson } from './http';

export async function fetchResearchReports(token: string) {
  return requestJson<Array<{
    id: string; title: string; sector: string; ticker?: string | null;
    report_type: string; confidence: number; published_at: string; tags: string[];
  }>>('/research/', { token });
}
