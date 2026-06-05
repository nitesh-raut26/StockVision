/**
 * SavedScreensBar — save the current screener config, reload saved ones, and opt a
 * screen into match alerts. Self-contained: runs its own queries + mutations.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Bell, BellOff, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fetchSavedScreens, saveScreen, deleteSavedScreen, toggleScreenAlert } from '../../lib/api';

interface Props {
  currentFilters: Record<string, unknown>;
  onLoad: (filters: Record<string, unknown>) => void;
}

export default function SavedScreensBar({ currentFilters, onLoad }: Props) {
  const { authToken } = useStore();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const screensQuery = useQuery({ queryKey: ['saved-screens', authToken], queryFn: () => fetchSavedScreens(authToken) });
  const screens = screensQuery.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['saved-screens', authToken] });

  if (!authToken) {
    return (
      <div style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <Bookmark size={13} /> Sign in to save screens &amp; get an alert when new stocks match.
      </div>
    );
  }

  const handleSave = async () => {
    const name = window.prompt('Name this screen', 'My screen');
    if (!name) return;
    setBusy(true);
    await saveScreen(name, currentFilters, authToken);
    await refresh();
    setBusy(false);
  };
  const handleDelete = async (id: string) => {
    setBusy(true); await deleteSavedScreen(id, authToken); await refresh(); setBusy(false);
  };
  const handleAlert = async (id: string, cur: boolean) => {
    setBusy(true); await toggleScreenAlert(id, !cur, authToken); await refresh(); setBusy(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <button onClick={handleSave} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-brand)', background: 'var(--brand-dim)', color: 'var(--brand)', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        <Bookmark size={13} /> Save screen
      </button>

      {screens.map((s) => (
        <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '5px 8px 5px 12px', borderRadius: 99, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <button onClick={() => onLoad(s.filters)} title="Load screen"
            style={{ background: 'none', border: 'none', color: 'var(--tx-2)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>
            {s.name}
          </button>
          <button onClick={() => handleAlert(s.id, s.alert_enabled)} title={s.alert_enabled ? 'Match alert on' : 'Match alert off'}
            style={{ background: 'none', border: 'none', color: s.alert_enabled ? 'var(--gain)' : 'var(--tx-3)', cursor: 'pointer', display: 'flex', padding: 0 }}>
            {s.alert_enabled ? <Bell size={12} /> : <BellOff size={12} />}
          </button>
          <button onClick={() => handleDelete(s.id)} title="Delete screen"
            style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', display: 'flex', padding: 0 }}>
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
