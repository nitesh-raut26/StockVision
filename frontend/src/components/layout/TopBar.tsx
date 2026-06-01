import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Globe, Menu, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fetchIndices, searchMarket } from '../../lib/api';
import { useIsMobile } from '../../hooks/useBreakpoint';
import NotificationPanel from '../ui/NotificationPanel';

/* Mobile topbar is 84px tall: 56px main row + 28px indices ticker strip */
export const TOPBAR_H = { mobile: 84, desktop: 56 };

export default function TopBar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, language, setLanguage, sidebarOpen, setSidebarOpen } = useStore();
  const [search, setSearch]               = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const sidebarW = isMobile ? 0 : (sidebarOpen ? 240 : 60);

  const indicesQuery = useQuery({
    queryKey: ['market-indices'],
    queryFn: fetchIndices,
    refetchInterval: 15000,
  });

  const searchQuery = useQuery({
    queryKey: ['market-search', deferredSearch],
    queryFn: () => searchMarket(deferredSearch),
    enabled: deferredSearch.length >= 2,
  });

  const suggestions  = searchQuery.data ?? [];
  const allIndices   = indicesQuery.data ?? [];

  /* Desktop: show 2 when sidebar open, 3 when collapsed */
  const desktopIndices = useMemo(
    () => allIndices.slice(0, sidebarOpen ? 2 : 3),
    [allIndices, sidebarOpen],
  );

  const closeSearch = () => { setSearchFocused(false); setSearch(''); };
  const handleNavigate = (path: string) => { closeSearch(); navigate(path); };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (suggestions[0]) { handleNavigate(suggestions[0].path); return; }
    if (!search.trim()) return;
    navigate('/app/screener');
    closeSearch();
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--r-md)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--tx-2)',
    cursor: 'pointer',
    transition: 'border-color 150ms, color 150ms',
    flexShrink: 0,
  };

  const totalH = isMobile ? TOPBAR_H.mobile : TOPBAR_H.desktop;

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: sidebarW,
      right: 0,
      height: totalH,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      transition: 'left 220ms cubic-bezier(.4,0,.2,1)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    }}>

      {/* ── Main controls row (56px) ─────────────────────────────── */}
      <div style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 14px' : '0 24px',
        gap: 12,
        flexShrink: 0,
      }}>

        {/* ── Left ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : sidebarOpen ? 12 : 16, flexShrink: 1, minWidth: 0, overflow: 'hidden' }}>

          {/* Mobile: hamburger + brand icon */}
          {isMobile && (
            <>
              <button type="button" aria-label="Toggle navigation"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={iconBtnStyle}>
                <Menu size={16} />
              </button>
              <div style={{
                width: 30, height: 30,
                background: 'var(--brand)',
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(244,117,32,0.4)',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="9.5" width="3" height="5" rx="0.8" fill="white" />
                  <rect x="6.5" y="6" width="3" height="8.5" rx="0.8" fill="white" />
                  <rect x="11.5" y="1.5" width="3" height="13" rx="0.8" fill="white" />
                </svg>
              </div>
            </>
          )}

          {/* Desktop: LIVE badge + premium index chips */}
          {!isMobile && (
            <>
              {/* Live indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 9px',
                background: 'rgba(45,181,98,0.08)',
                border: '1px solid rgba(45,181,98,0.2)',
                borderRadius: 6,
                flexShrink: 0,
              }}>
                <span className="live-dot" style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#2db562',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #2db562',
                }} />
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#2db562', letterSpacing: '0.1em' }}>LIVE</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />

              {/* Index chips */}
              {desktopIndices.map((index, i) => (
                <div key={index.name} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  {i > 0 && (
                    <div style={{ width: 1, height: 18, background: 'var(--border)', marginRight: sidebarOpen ? 12 : 16, flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10.5,
                      color: 'var(--tx-3)',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}>
                      {index.name}
                    </span>
                    <span className="num" style={{
                      fontSize: i === 0 ? 14 : i === 1 ? 13.5 : 12.5,
                      color: 'var(--tx)',
                      fontWeight: 800,
                      letterSpacing: '-0.015em',
                      whiteSpace: 'nowrap',
                    }}>
                      {index.value.toLocaleString('en-IN')}
                    </span>
                    <span className="num" style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      background: index.changePct >= 0 ? 'rgba(0,200,150,0.10)' : 'rgba(255,77,106,0.10)',
                      color: index.changePct >= 0 ? 'var(--gain)' : 'var(--loss)',
                      borderRadius: 5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {index.changePct >= 0 ? '+' : ''}{index.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Right: search + lang + avatar ────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, flexShrink: 0 }}>

          {/* Search: icon-only on mobile → expands overlay; full input on desktop */}
          {isMobile ? (
            <button type="button" aria-label="Open search"
              onClick={() => setSearchExpanded(true)}
              style={iconBtnStyle}>
              <Search size={16} />
            </button>
          ) : (
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
                placeholder="Search stocks, funds…"
                style={{
                  paddingLeft: 32, paddingRight: 14, paddingTop: 7, paddingBottom: 7,
                  width: 220,
                  fontSize: 13,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--tx)',
                  fontFamily: 'inherit',
                }}
              />
              {searchFocused && deferredSearch.length >= 2 && (
                <div className="search-popover">
                  {searchQuery.isLoading && <div className="search-empty">Searching market data…</div>}
                  {!searchQuery.isLoading && suggestions.length === 0 && <div className="search-empty">No matches found.</div>}
                  {suggestions.map(result => (
                    <button key={`${result.type}-${result.id}`} type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => handleNavigate(result.path)}
                      className="search-result">
                      <span className="search-result-label">{result.label}</span>
                      <span className="search-result-subtitle">{result.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}

          {/* Notification bell */}
          <NotificationPanel />

          {/* Language toggle — icon-only on mobile to save space */}
          <button onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: isMobile ? '7px 9px' : '6px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--tx-2)', fontSize: 12.5, fontWeight: 600, transition: 'border-color 150ms', fontFamily: 'inherit' }}>
            <Globe size={13} />
            {!isMobile && (language === 'en' ? 'EN' : 'HI')}
          </button>

          {/* User avatar */}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--border-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--brand)', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
            {user?.name?.[0] ?? 'U'}
          </div>
        </div>
      </div>

      {/* ── Mobile: full-width search overlay (slides over main row) ── */}
      {isMobile && searchExpanded && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 56,
          background: 'var(--bg-surface)', display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 10, zIndex: 10,
        }}>
          <button type="button" aria-label="Close search"
            onClick={() => { setSearchExpanded(false); closeSearch(); }}
            style={iconBtnStyle}>
            <ChevronLeft size={16} />
          </button>
          <form
            onSubmit={(e) => { handleSearchSubmit(e); setSearchExpanded(false); }}
            style={{ position: 'relative', flex: 1 }}
          >
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              autoFocus
              value={search}
              onChange={event => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
              placeholder="Search stocks, funds…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 14,
                paddingTop: 8, paddingBottom: 8,
                fontSize: 13.5,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-brand)',
                borderRadius: 'var(--r-md)',
                color: 'var(--tx)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {searchFocused && deferredSearch.length >= 2 && (
              <div className="search-popover">
                {searchQuery.isLoading && <div className="search-empty">Searching market data…</div>}
                {!searchQuery.isLoading && suggestions.length === 0 && <div className="search-empty">No matches found.</div>}
                {suggestions.map(result => (
                  <button key={`${result.type}-${result.id}`} type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => { handleNavigate(result.path); setSearchExpanded(false); }}
                    className="search-result">
                    <span className="search-result-label">{result.label}</span>
                    <span className="search-result-subtitle">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── Mobile: scrolling indices ticker strip (28px) ─────────── */}
      {isMobile && (
        <div style={{
          height: 28,
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-card)',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}>
          {allIndices.length > 0 ? (
            <div
              className="ticker-track"
              style={{ animationDuration: '28s', height: '100%', alignItems: 'center' }}
            >
              {[...allIndices, ...allIndices].map((index, i) => (
                <span key={`${index.name}-${i}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 14px',
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                    {index.name}
                  </span>
                  <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx)', whiteSpace: 'nowrap' }}>
                    {index.value.toLocaleString('en-IN')}
                  </span>
                  <span className="num" style={{
                    fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                    color: index.changePct >= 0 ? 'var(--gain)' : 'var(--loss)',
                  }}>
                    {index.changePct >= 0 ? '+' : ''}{index.changePct.toFixed(2)}%
                  </span>
                  <span style={{ color: 'var(--border-md)', fontSize: 13, marginLeft: 4 }}>·</span>
                </span>
              ))}
            </div>
          ) : (
            /* Loading placeholder */
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 16px', gap: 8 }}>
              {[100, 80, 90, 70, 85].map((w, i) => (
                <div key={i} style={{ height: 8, width: w, borderRadius: 4, background: 'var(--surface-mid)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              ))}
            </div>
          )}
          {/* Edge fade masks */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 32, height: '100%', background: 'var(--fade-l)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 32, height: '100%', background: 'var(--fade-r)', pointerEvents: 'none', zIndex: 1 }} />
        </div>
      )}
    </header>
  );
}
