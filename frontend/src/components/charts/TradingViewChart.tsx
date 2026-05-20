/**
 * TradingViewChart — Production-grade chart component using lightweight-charts v4.
 *
 * Why lightweight-charts instead of Recharts:
 *  - Hardware-accelerated Canvas rendering (60fps vs Recharts SVG ~30fps)
 *  - Purpose-built for financial OHLCV data
 *  - Native candlestick, area, bar, and histogram series
 *  - Built-in crosshair, price scale, time scale with Indian format
 *  - Real-time update API (appendData / update) without full re-render
 *  - 40KB gzip vs Recharts 120KB gzip
 *
 * Scalability: The `appendData` / `update` path is O(1) — no React re-render
 * required for live tick updates, making this WebSocket-ready out of the box.
 */

import { useEffect, useRef, useCallback, memo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts';

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface OHLCVPoint {
  time: string;       // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AreaPoint {
  time: string;
  value: number;
}

export interface IndicatorLine {
  time: string;
  value: number | null;
}

export type ChartType = 'candlestick' | 'area' | 'line';

interface TradingViewChartProps {
  /** OHLCV data for candlestick / area fallback */
  data: OHLCVPoint[] | AreaPoint[];
  type?: ChartType;
  height?: number;
  /** Show volume histogram below price */
  showVolume?: boolean;
  /** Optional overlay lines (EMA20, EMA50 etc.) */
  overlays?: { label: string; color: string; data: IndicatorLine[] }[];
  /** Positive = green area, negative = red */
  isPositive?: boolean;
  /** Called with the API handle so parent can push live ticks */
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>) => void;
  /** Dark / light theme */
  isDark?: boolean;
}

/* ─── Theme tokens ────────────────────────────────────────────────────────── */

const makeTheme = (isDark: boolean): DeepPartial<ChartOptions> => ({
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: isDark ? '#7c8196' : '#6b7280',
    fontSize: 11,
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  grid: {
    vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', style: LineStyle.Solid },
    horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', style: LineStyle.Solid },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: isDark ? 'rgba(244,117,32,0.6)' : 'rgba(244,117,32,0.5)',
      labelBackgroundColor: '#f47520',
      width: 1,
      style: LineStyle.Dashed,
    },
    horzLine: {
      color: isDark ? 'rgba(244,117,32,0.6)' : 'rgba(244,117,32,0.5)',
      labelBackgroundColor: '#f47520',
      width: 1,
      style: LineStyle.Dashed,
    },
  },
  rightPriceScale: {
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    scaleMargins: { top: 0.08, bottom: 0.2 },
  },
  timeScale: {
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    timeVisible: true,
    secondsVisible: false,
    fixLeftEdge: true,
    fixRightEdge: true,
  },
});

/* ─── Helper: normalise mixed input to typed arrays ──────────────────────── */

function isOHLCV(arr: OHLCVPoint[] | AreaPoint[]): arr is OHLCVPoint[] {
  return arr.length > 0 && 'open' in arr[0];
}

function sortByTime<T extends { time: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.time.localeCompare(b.time));
}

/* ─── Component ─────────────────────────────────────────────────────────── */

const TradingViewChart = memo(function TradingViewChart({
  data,
  type = 'candlestick',
  height = 320,
  showVolume = true,
  overlays = [],
  isPositive = true,
  onChartReady,
  isDark = true,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlayRefs  = useRef<ISeriesApi<'Line'>[]>([]);

  /* ─── Build / destroy chart ─────────────────────────────────── */
  const buildChart = useCallback(() => {
    if (!containerRef.current || !data.length) return;

    // Destroy previous instance cleanly
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Cast through OHLCVPoint[] to satisfy the generic constraint, then
    // widen back to the full union so isOHLCV() type-guard works correctly.
    const sorted: OHLCVPoint[] | AreaPoint[] =
      sortByTime(data as OHLCVPoint[]) as OHLCVPoint[] | AreaPoint[];
    const gainColor  = '#2db562';
    const lossColor  = '#e53935';
    const priceColor = isPositive ? gainColor : lossColor;

    const chart = createChart(containerRef.current, {
      ...makeTheme(isDark),
      width: containerRef.current.clientWidth,
      height,
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // ── Price series ──
    if (type === 'candlestick' && isOHLCV(sorted)) {
      const candle = chart.addCandlestickSeries({
        upColor:          gainColor,
        downColor:        lossColor,
        borderUpColor:    gainColor,
        borderDownColor:  lossColor,
        wickUpColor:      gainColor,
        wickDownColor:    lossColor,
      });
      const cData: CandlestickData[] = sorted.map(d => ({
        time:  d.time as Time,
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
      }));
      candle.setData(cData);
      seriesRef.current = candle as ISeriesApi<'Candlestick'>;
    } else {
      // Area / line fallback — works for both OHLCV (uses close) and AreaPoint
      const area = chart.addAreaSeries({
        lineColor:         priceColor,
        topColor:          `${priceColor}28`,
        bottomColor:       `${priceColor}00`,
        lineWidth:         2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius:  4,
        crosshairMarkerBorderColor: priceColor,
        crosshairMarkerBackgroundColor: priceColor,
      });
      const aData: LineData[] = sorted.map(d => ({
        time:  d.time as Time,
        value: 'close' in d ? (d as OHLCVPoint).close : (d as AreaPoint).value,
      }));
      area.setData(aData);
      seriesRef.current = area as ISeriesApi<'Area'>;
    }

    // ── Volume histogram ──
    if (showVolume && isOHLCV(sorted)) {
      const vol = chart.addHistogramSeries({
        color:   '#7c819630',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
        borderVisible: false,
      });
      const vData: HistogramData[] = sorted.map(d => ({
        time:  d.time as Time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? '#2db56228' : '#e5393528',
      }));
      vol.setData(vData);
      volSeriesRef.current = vol;
    }

    // ── Overlay lines (EMA20, EMA50 etc.) ──
    overlayRefs.current = overlays.map(ov => {
      const line = chart.addLineSeries({
        color:     ov.color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const lData: LineData[] = ov.data
        .filter(p => p.value !== null)
        .map(p => ({ time: p.time as Time, value: p.value as number }));
      line.setData(lData);
      return line;
    });

    chart.timeScale().fitContent();

    if (onChartReady && seriesRef.current) {
      onChartReady(chart, seriesRef.current as any);
    }
  }, [data, type, height, showVolume, overlays, isPositive, isDark, onChartReady]);

  /* ─── Resize observer ────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /* ─── Build on data / theme change ──────────────────────────── */
  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}
    />
  );
});

export default TradingViewChart;

/* ─── Live tick helper — call this to push a WebSocket tick ──────────────── */
export function pushTick(
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>,
  tick: OHLCVPoint | AreaPoint,
) {
  if ('open' in tick) {
    (series as ISeriesApi<'Candlestick'>).update({
      time:  tick.time as Time,
      open:  tick.open,
      high:  tick.high,
      low:   tick.low,
      close: tick.close,
    });
  } else {
    (series as ISeriesApi<'Area'>).update({
      time:  tick.time as Time,
      value: tick.value,
    });
  }
}
