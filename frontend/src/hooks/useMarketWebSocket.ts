/**
 * useMarketWebSocket — React hook for real-time market price updates.
 *
 * Architecture:
 *   - Single shared WebSocket connection per component tree (Ref-based)
 *   - Reconnects automatically on disconnect (exponential backoff, max 30s)
 *   - Snapshot → streaming: sends initial price update on connect
 *   - Deduplication: only triggers re-render when price changes
 *
 * Usage:
 *   const { prices, connected } = useMarketWebSocket(['RELIANCE', 'TCS', 'INFY']);
 *   // prices = { RELIANCE: { price: 2923, change: 12.3, change_pct: 0.42, ... } }
 *
 * Performance:
 *   Uses a Map + only calls setState when a ticker price actually changes,
 *   avoiding unnecessary React re-renders on heartbeat messages.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1')
  .replace(/\/$/, '')
  .replace(/^http/, 'ws')    // http → ws, https → wss (replace "http" only so the trailing "s" survives)
  .replace('/api/v1', '');   // WebSocket is at root, not /api/v1

export interface TickerPrice {
  price:      number;
  change:     number;
  change_pct: number;
  volume:     number;
  ts:         number;
  type:       'snapshot' | 'price';
}

interface UseMarketWebSocketResult {
  prices:    Record<string, TickerPrice>;
  connected: boolean;
  error:     string | null;
}

const MAX_RETRIES    = 8;
const BASE_DELAY_MS  = 1000;
const MAX_DELAY_MS   = 30000;

export function useMarketWebSocket(
  tickers: string[],
  enabled: boolean = true,
): UseMarketWebSocketResult {
  const [prices,    setPrices]    = useState<Record<string, TickerPrice>>({});
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickersRef = useRef<string[]>(tickers);
  tickersRef.current = tickers;

  const connect = useCallback(() => {
    if (!enabled || !tickersRef.current.length) return;

    const tickerParam = tickersRef.current.join(',');
    const url = `${API_BASE}/api/v1/ws/market?tickers=${encodeURIComponent(tickerParam)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        retryRef.current = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'heartbeat' || msg.type === 'pong') return;

          if (msg.type === 'price' || msg.type === 'snapshot') {
            const { ticker, price, change, change_pct, volume, ts, type } = msg;
            if (!ticker) return;

            setPrices(prev => {
              const existing = prev[ticker];
              // Skip re-render if nothing meaningful changed
              if (existing && Math.abs(existing.price - price) < 0.001) return prev;
              return {
                ...prev,
                [ticker]: { price, change, change_pct, volume, ts, type },
              };
            });
          }

          if (msg.type === 'error') {
            setError(msg.text || 'WebSocket error');
          }
        } catch {
          // Invalid JSON — ignore
        }
      };

      ws.onerror = () => {
        setError('Connection error');
        setConnected(false);
      };

      ws.onclose = (evt) => {
        setConnected(false);
        wsRef.current = null;

        if (!enabled || evt.code === 1000) return; // clean close

        // Exponential backoff reconnect
        const attempt = retryRef.current++;
        if (attempt >= MAX_RETRIES) {
          setError('Could not connect to real-time feed. Will retry shortly.');
          timerRef.current = setTimeout(() => {
            retryRef.current = 0;
            connect();
          }, MAX_DELAY_MS);
          return;
        }

        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        timerRef.current = setTimeout(connect, delay);
      };
    } catch (err) {
      setError('WebSocket not supported');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect, enabled, tickers.join(',')]);

  return { prices, connected, error };
}
