/**
 * AIAssistant — StockVision AI Financial Chat
 *
 * Architecture:
 *  - POST /api/v1/ai/chat → Server-Sent Events stream
 *  - fetch() + ReadableStream (works for POST, unlike EventSource)
 *  - Tool-call awareness: shows "Fetching live price…" while Claude calls tools
 *  - Inline markdown renderer with React Router <Link> for $TICKER mentions
 *  - Plan-gated: free=3/min, premium=20, pro=100 messages
 *  - AI Report generator: POST /api/v1/ai/report/{ticker}
 */

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, Sparkles, AlertCircle, Loader2, TrendingUp, TrendingDown,
  Lock, MessageSquare, BarChart3, Zap, RefreshCw, Brain,
  ChevronDown, ChevronUp, ExternalLink, FileText, Cpu,
  GitCompare, Lightbulb, Target, type LucideIcon,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useIsMobile } from '../hooks/useBreakpoint';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

const PLAN_LIMITS: Record<string, number> = {
  free:       3,
  premium:   20,
  pro:       100,
  enterprise: 999999,
};

const TOOL_LABELS: Record<string, { icon: LucideIcon; label: string }> = {
  get_stock_price:       { icon: TrendingUp, label: 'Fetching live price…'   },
  get_fundamentals:      { icon: BarChart3,  label: 'Loading fundamentals…'  },
  get_technical_signals: { icon: Zap,        label: 'Analysing technicals…'  },
};

const QUICK_PROMPTS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: BarChart3,  label: 'Is RELIANCE a buy?',      prompt: 'Should I buy Reliance Industries right now? Give me a quick fundamental and technical analysis.' },
  { icon: TrendingUp, label: 'Market outlook 2026',      prompt: 'What is the current Indian stock market outlook for 2026? Key sectors to watch?' },
  { icon: Zap,        label: 'Top defence stocks',       prompt: 'What are the best defence sector stocks in India right now? List top 5 with brief rationale.' },
  { icon: GitCompare, label: 'TCS vs Infosys',           prompt: 'Compare TCS and Infosys fundamentally — which is a better long-term investment?' },
  { icon: Lightbulb,  label: 'Explain P/E ratio',        prompt: 'Explain the Price-to-Earnings ratio simply and how to use it effectively for Indian stocks.' },
  { icon: Target,     label: 'NIFTY 50 analysis',        prompt: 'Analyse the current NIFTY 50 technical setup — is it a good time to enter?' },
];

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface Message {
  id:          string;
  role:        'user' | 'assistant';
  content:     string;
  toolCalls?:  string[];
  isStreaming?: boolean;
  isError?:    boolean;
  timestamp:   number;
}

interface ReportState {
  loading:   boolean;
  ticker:    string;
  data:      Record<string, unknown> | null;
  error:     string | null;
}

/* ─── Markdown → React renderer ─────────────────────────────────────────────── */
// Renders Claude's markdown output as React nodes, with $TICKER linkification.

type ReactChild = React.ReactElement | string | null;

function InlineContent({ text }: { text: string }) {
  // Split on bold (**), italic (*), inline code (`), and $TICKER
  const parts: ReactChild[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\$([A-Z]{2,8})\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));

    if (m[1].startsWith('**')) {
      parts.push(<strong key={m.index}>{m[2]}</strong>);
    } else if (m[1].startsWith('*')) {
      parts.push(<em key={m.index}>{m[3]}</em>);
    } else if (m[1].startsWith('`')) {
      parts.push(
        <code key={m.index} style={{ background: 'rgba(244,117,32,0.12)', color: 'var(--brand)', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: "'JetBrains Mono', monospace" }}>
          {m[4]}
        </code>
      );
    } else if (m[1].startsWith('$')) {
      // $TICKER → link
      parts.push(
        <Link key={m.index} to={`/app/stock/${m[5]}`}
          style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none', borderBottom: '1px dashed var(--brand)', fontSize: '0.95em' }}
          title={`View ${m[5]} on StockVision`}>
          {m[1]}
        </Link>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const result: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let orderedBuf: string[] = [];
  let tableLines: string[] = [];

  const flushList = (ordered: boolean) => {
    const items = ordered ? orderedBuf : listBuf;
    if (!items.length) return;
    result.push(
      ordered
        ? <ol key={result.length} style={{ margin: '6px 0', paddingLeft: 20, color: 'var(--tx-2)', fontSize: 14, lineHeight: 1.7 }}>
            {items.map((li, i) => <li key={i}><InlineContent text={li} /></li>)}
          </ol>
        : <ul key={result.length} style={{ margin: '6px 0', paddingLeft: 20, color: 'var(--tx-2)', fontSize: 14, lineHeight: 1.7 }}>
            {items.map((li, i) => <li key={i}><InlineContent text={li} /></li>)}
          </ul>
    );
    listBuf = [];
    orderedBuf = [];
  };

  const flushTable = () => {
    if (tableLines.length < 2) { tableLines = []; return; }
    const headers = tableLines[0].split('|').map(s => s.trim()).filter(Boolean);
    const rows    = tableLines.slice(2).map(l => l.split('|').map(s => s.trim()).filter(Boolean));
    result.push(
      <div key={result.length} style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-md)', color: 'var(--tx-3)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <InlineContent text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? 'var(--bg-elevated)' : 'transparent' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--tx-2)', fontSize: 13 }}>
                    <InlineContent text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith('|')) {
      flushList(false); flushList(true);
      tableLines.push(line);
      continue;
    } else if (tableLines.length) {
      flushTable();
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList(false); flushList(true);
      result.push(
        <h4 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', margin: '14px 0 6px', letterSpacing: '-0.01em' }}>
          <InlineContent text={line.slice(4)} />
        </h4>
      );
    } else if (line.startsWith('## ')) {
      flushList(false); flushList(true);
      result.push(
        <h3 key={i} style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', margin: '16px 0 8px', letterSpacing: '-0.015em', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <InlineContent text={line.slice(3)} />
        </h3>
      );
    } else if (line.startsWith('# ')) {
      flushList(false); flushList(true);
      result.push(
        <h2 key={i} style={{ fontSize: 17, fontWeight: 900, color: 'var(--tx)', margin: '18px 0 8px', letterSpacing: '-0.02em' }}>
          <InlineContent text={line.slice(2)} />
        </h2>
      );
    }
    // Unordered list
    else if (/^[-•]\s/.test(line)) {
      flushList(true);
      listBuf.push(line.replace(/^[-•]\s/, ''));
    }
    // Ordered list
    else if (/^\d+\.\s/.test(line)) {
      flushList(false);
      orderedBuf.push(line.replace(/^\d+\.\s/, ''));
    }
    // Blockquote / disclaimer
    else if (line.startsWith('> ') || line.startsWith('⚠️')) {
      flushList(false); flushList(true);
      result.push(
        <div key={i} style={{ background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.2)', borderRadius: 8, padding: '8px 12px', margin: '8px 0', fontSize: 12.5, color: 'var(--tx-3)', lineHeight: 1.55 }}>
          <InlineContent text={line.replace(/^> /, '')} />
        </div>
      );
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      flushList(false); flushList(true);
      result.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
    }
    // Empty line
    else if (!line.trim()) {
      flushList(false); flushList(true);
      result.push(<div key={i} style={{ height: 6 }} />);
    }
    // Normal paragraph
    else {
      flushList(false); flushList(true);
      result.push(
        <p key={i} style={{ margin: '2px 0', color: 'var(--tx-2)', fontSize: 14, lineHeight: 1.7 }}>
          <InlineContent text={line} />
        </p>
      );
    }
  }

  // Flush any remaining list/table
  flushList(false);
  flushList(true);
  if (tableLines.length) flushTable();

  return <div>{result}</div>;
}

/* ─── Streaming fetch ─────────────────────────────────────────────────────────
   POST /ai/chat with SSE response.
   Yields parsed event objects.
*/

async function* streamChat(
  messages: { role: string; content: string }[],
  authToken: string | null,
  model: string,
): AsyncGenerator<Record<string, unknown>> {
  const resp = await fetch(`${API_BASE}/ai/chat`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'text/event-stream',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!resp.ok) {
    let detail = 'AI service error';
    try   { detail = (await resp.json()).detail ?? detail; }
    catch { /* ignore */ }
    yield { type: 'error', text: detail };
    return;
  }

  const reader  = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try { yield JSON.parse(raw); }
      catch { /* skip bad JSON */ }
    }
  }
}

/* ─── AI Report card ─────────────────────────────────────────────────────────── */

function ReportCard({ report }: { report: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const rec   = String(report.recommendation ?? 'Hold');
  const score = Number(report.confidence_score ?? 0);
  const recColor = rec === 'Buy' ? 'var(--gain)' : rec === 'Sell' ? 'var(--loss)' : 'var(--gold)';

  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', marginTop: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
          <FileText size={13} color="var(--brand)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: isMobile ? 12.5 : 13.5, fontWeight: 700, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMobile ? `Report — ${String(report.ticker)}` : `AI Research Report — ${String(report.ticker)}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: `${recColor}15`, color: recColor, border: `1px solid ${recColor}40`, whiteSpace: 'nowrap' }}>
            {rec}
          </span>
          <button onClick={() => setOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', padding: 2 }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(3, 1fr)', gap: 8, marginBottom: open ? 16 : 0 }}>
        {[
          { label: '12M Target', value: `₹${Number(report.target_price_12m ?? 0).toLocaleString('en-IN')}` },
          { label: 'Confidence',  value: `${score}/10` },
          { label: 'Detail',      value: String(report.detail_level ?? 'Standard') },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 3, fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.65, margin: 0 }}>
            {String(report.summary ?? '')}
          </p>

          {[
            { title: 'Bull Thesis', icon: TrendingUp,   key: 'bull_thesis', color: 'var(--gain)' },
            { title: 'Bear Thesis', icon: TrendingDown, key: 'bear_thesis', color: 'var(--loss)' },
            { title: 'Key Risks',   icon: AlertCircle,  key: 'key_risks',   color: 'var(--gold)' },
          ].map(section => {
            const items = Array.isArray(report[section.key]) ? (report[section.key] as string[]) : [];
            return items.length ? (
              <div key={section.key}>
                <div style={{ fontSize: 12, fontWeight: 700, color: section.color, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><section.icon size={13} />{section.title}</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {items.map((item, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55, marginBottom: 3 }}>{String(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}

          {!!report.valuation_analysis && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><BarChart3 size={12} />Valuation</div>
              <p style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55, margin: 0 }}>{String(report.valuation_analysis)}</p>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, padding: '8px 10px', background: 'rgba(229,57,53,0.04)', borderRadius: 6, lineHeight: 1.5 }}>
            <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />{String(report.disclaimer ?? 'Educational purposes only — not investment advice')}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function AIAssistant() {
  const { user, authToken }           = useStore();
  const navigate                       = useNavigate();
  const isMobile                       = useIsMobile();
  const plan                           = user?.plan ?? 'free';
  const planLimit                      = PLAN_LIMITS[plan] ?? 3;

  const [messages,      setMessages]   = useState<Message[]>([]);
  const [input,         setInput]      = useState('');
  const [usedCount,     setUsedCount]  = useState(0);
  const [isStreaming,   setIsStreaming] = useState(false);
  const [model,         setModel]      = useState<'claude-haiku-4-5' | 'claude-sonnet-4-5'>('claude-haiku-4-5');
  const [showReport,    setShowReport] = useState(false);
  const [reportTicker,  setReportTicker] = useState('');
  const [report,        setReport]     = useState<ReportState>({ loading: false, ticker: '', data: null, error: null });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  /* ── Send message ─────────────────────────────────────────────── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    if (usedCount >= planLimit) return;

    setInput('');
    setUsedCount(c => c + 1);

    const userMsg: Message = { id: makeId(), role: 'user', content: text.trim(), timestamp: Date.now() };
    const asstId = makeId();
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    // Build conversation history (without the streaming placeholder)
    const history = [...messages, userMsg]
      .filter(m => m.content && !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      for await (const event of streamChat(history, authToken, model)) {
        const evt = event as { type: string; text?: string; tools?: string[] };

        if (evt.type === 'text') {
          setMessages(prev => prev.map(m =>
            m.id === asstId ? { ...m, content: m.content + (evt.text ?? '') } : m
          ));
        } else if (evt.type === 'tool_use') {
          setMessages(prev => prev.map(m =>
            m.id === asstId ? { ...m, toolCalls: evt.tools ?? [] } : m
          ));
        } else if (evt.type === 'done') {
          break;
        } else if (evt.type === 'error') {
          setMessages(prev => prev.map(m =>
            m.id === asstId
              ? { ...m, content: evt.text ?? 'An error occurred.', isError: true, isStreaming: false }
              : m
          ));
          setIsStreaming(false);
          return;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach AI service';
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: msg, isError: true, isStreaming: false } : m
      ));
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, isStreaming: false, toolCalls: undefined } : m
      ));
      setIsStreaming(false);
    }
  }, [messages, isStreaming, usedCount, planLimit, authToken, model]);

  /* ── Generate AI Report ───────────────────────────────────────── */
  const generateReport = useCallback(async () => {
    const t = reportTicker.trim().toUpperCase();
    if (!t) return;
    setReport({ loading: true, ticker: t, data: null, error: null });
    try {
      const resp = await fetch(`${API_BASE}/ai/report/${t}`, {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ detail_level: plan === 'pro' || plan === 'enterprise' ? 'deep' : 'standard' }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        setReport(prev => ({ ...prev, loading: false, error: e.detail ?? 'Report generation failed' }));
        return;
      }
      const data = await resp.json();
      setReport({ loading: false, ticker: t, data, error: null });
      setShowReport(false);
    } catch (err) {
      setReport(prev => ({ ...prev, loading: false, error: 'Network error — please try again' }));
    }
  }, [reportTicker, authToken, plan]);

  /* ── Keyboard handler ─────────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const remaining = Math.max(0, planLimit - usedCount);
  const isAtLimit = remaining === 0;

  /* ─── Render ───────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
      style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100dvh - 210px)' : 'calc(100vh - 80px)', maxWidth: 860, width: '100%' }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: isMobile ? '10px 14px' : '14px 20px', marginBottom: 10, flexShrink: 0 }}>
        {isMobile ? (
          /* ── Mobile: title row + controls row ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Title row — full width, no competition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #f47520, #e53935)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Brain size={14} color="#fff" />
              </div>
              <h1 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx)', margin: 0, letterSpacing: '-0.01em' }}>StockVision AI</h1>
            </div>
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Model selector (pro/enterprise only) — takes available space */}
              {(plan === 'pro' || plan === 'enterprise') && (
                <div style={{ display: 'flex', flex: 1, gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                  {(['claude-haiku-4-5', 'claude-sonnet-4-5'] as const).map(m => (
                    <button key={m} onClick={() => setModel(m)}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: model === m ? 'var(--brand-dim)' : 'transparent', color: model === m ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms', fontFamily: 'inherit', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {m === 'claude-haiku-4-5' ? 'Haiku · Fast' : 'Sonnet · Deep'}
                    </button>
                  ))}
                </div>
              )}
              {/* Report button — icon only */}
              <button onClick={() => setShowReport(v => !v)} title="AI Report"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', cursor: 'pointer', flexShrink: 0 }}>
                <FileText size={14} />
              </button>
              {/* Usage counter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: isAtLimit ? 'rgba(229,57,53,0.08)' : 'var(--bg-elevated)', border: `1px solid ${isAtLimit ? 'rgba(229,57,53,0.3)' : 'var(--border)'}`, flexShrink: 0 }}>
                <Zap size={10} color={isAtLimit ? 'var(--loss)' : 'var(--brand)'} />
                <span style={{ fontSize: 11, fontWeight: 700, color: isAtLimit ? 'var(--loss)' : 'var(--tx-2)' }}>
                  {remaining}/{planLimit === 999999 ? '∞' : planLimit}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── Desktop: single row ── */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #f47520, #e53935)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Brain size={18} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', margin: 0, letterSpacing: '-0.01em' }}>StockVision AI</h1>
                <p style={{ fontSize: 11.5, color: 'var(--tx-3)', margin: 0 }}>
                  Powered by Claude {model === 'claude-sonnet-4-5' ? 'Sonnet' : 'Haiku'} · Indian Market Expert
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {(plan === 'pro' || plan === 'enterprise') && (
                <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                  {(['claude-haiku-4-5', 'claude-sonnet-4-5'] as const).map(m => (
                    <button key={m} onClick={() => setModel(m)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: model === m ? 'var(--brand-dim)' : 'transparent', color: model === m ? 'var(--brand)' : 'var(--tx-3)', transition: 'all 150ms', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {m === 'claude-haiku-4-5' ? 'Haiku · Fast' : 'Sonnet · Deep'}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowReport(v => !v)} title="AI Report"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <FileText size={13} />
                AI Report
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: isAtLimit ? 'rgba(229,57,53,0.08)' : 'var(--bg-elevated)', border: `1px solid ${isAtLimit ? 'rgba(229,57,53,0.3)' : 'var(--border)'}` }}>
                <Zap size={11} color={isAtLimit ? 'var(--loss)' : 'var(--brand)'} />
                <span style={{ fontSize: 11, fontWeight: 700, color: isAtLimit ? 'var(--loss)' : 'var(--tx-2)' }}>
                  {remaining}/{planLimit === 999999 ? '∞' : planLimit}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Report Generator Panel ─────────────────────────────────── */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card"
            style={{ padding: isMobile ? '12px 14px' : '14px 18px', marginBottom: 10, flexShrink: 0, overflow: 'hidden' }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <BarChart3 size={13} color="var(--brand)" />
              <span style={{ fontSize: isMobile ? 12.5 : 13.5, fontWeight: 700, color: 'var(--tx)' }}>AI Research Report Generator</span>
              {(plan === 'pro' || plan === 'enterprise') && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(244,117,32,0.12)', color: 'var(--brand)', border: '1px solid var(--border-brand)', whiteSpace: 'nowrap' }}>DEEP ANALYSIS</span>
              )}
            </div>
            {/* Input + button — stacks on mobile */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
              <input
                value={reportTicker}
                onChange={e => setReportTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && generateReport()}
                placeholder={isMobile ? 'NSE ticker (e.g. RELIANCE)' : 'NSE ticker (e.g. RELIANCE, TCS, INFY)'}
                style={{ flex: 1, padding: isMobile ? '9px 12px' : '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx)', fontSize: isMobile ? 13 : 13.5, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={generateReport} disabled={report.loading || !reportTicker}
                className="btn-primary"
                style={{ padding: isMobile ? '10px 0' : '9px 18px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (report.loading || !reportTicker) ? 0.6 : 1, width: isMobile ? '100%' : 'auto' }}>
                {report.loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                {report.loading ? 'Generating…' : 'Generate Report'}
              </button>
            </div>
            {report.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {report.error}
              </div>
            )}
            {!isMobile && (
              <p style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 8, lineHeight: 1.5, margin: '8px 0 0' }}>
                Generates structured analysis: summary · bull/bear thesis · valuation · technicals · 12M target.
                {plan === 'free' && ' Upgrade to Pro for deep analysis with full financial models.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Report display ─────────────────────────────────────────── */}
      {report.data && (
        <div style={{ marginBottom: 12, flexShrink: 0 }}>
          <ReportCard report={report.data} />
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 4, marginBottom: 8 }}>

        {/* Welcome screen when no messages */}
        {!messages.length && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '8px 4px' : '40px 20px',
            gap: isMobile ? 10 : 24,
            textAlign: 'center',
            overflow: 'hidden',
          }}>
            {/* Brain icon — smaller on mobile */}
            <div style={{
              width: isMobile ? 42 : 64,
              height: isMobile ? 42 : 64,
              borderRadius: isMobile ? 13 : 20,
              background: 'linear-gradient(135deg, rgba(244,117,32,0.2), rgba(229,57,53,0.15))',
              border: '1px solid rgba(244,117,32,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Brain size={isMobile ? 19 : 28} color="var(--brand)" />
            </div>

            {/* Title + description */}
            <div style={{ maxWidth: isMobile ? 320 : 400 }}>
              <h2 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: 'var(--tx)', margin: isMobile ? '0 0 4px' : '0 0 8px', letterSpacing: '-0.02em' }}>
                Ask Me Anything
              </h2>
              <p style={{ fontSize: isMobile ? 12 : 14, color: 'var(--tx-3)', margin: 0, lineHeight: isMobile ? 1.5 : 1.6 }}>
                {isMobile
                  ? <>Real-time NSE prices, fundamentals & signals. Use <code style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>$TICKER</code> for any stock.</>
                  : <>I have access to real-time NSE prices, fundamentals, and technical signals. Use <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: 13 }}>$TICKER</code> to reference any stock.</>
                }
              </p>
            </div>

            {/* Quick prompt buttons */}
            <div style={isMobile
              ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }
              : { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600 }
            }>
              {QUICK_PROMPTS.map(qp => (
                <button key={qp.label} onClick={() => sendMessage(qp.prompt)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: isMobile ? '7px 8px' : '8px 14px',
                    borderRadius: isMobile ? 9 : 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--tx-2)',
                    fontSize: isMobile ? 11.5 : 12.5,
                    fontWeight: 500, cursor: 'pointer', transition: 'all 150ms',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-brand)'; e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-2)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>
                  <qp.icon size={isMobile ? 14 : 15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', padding: '4px 0' }}
            >
              {msg.role === 'user' ? (
                /* User bubble */
                <div style={{ maxWidth: '80%', background: 'var(--brand)', borderRadius: '16px 16px 4px 16px', padding: '10px 16px', color: '#fff', fontSize: 14, lineHeight: 1.65 }}>
                  {msg.content}
                </div>
              ) : (
                /* AI bubble */
                <div style={{ maxWidth: '90%', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #f47520, #e53935)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Bot size={14} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Tool call badges */}
                      <AnimatePresence>
                        {msg.toolCalls?.length && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}
                          >
                            {msg.toolCalls.map(tool => {
                              const tl = TOOL_LABELS[tool] ?? { icon: Cpu, label: `Calling ${tool}…` };
                              return (
                                <div key={tool}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: 'rgba(244,117,32,0.08)', border: '1px solid rgba(244,117,32,0.2)', fontSize: 11.5, color: 'var(--brand)', fontWeight: 600 }}>
                                  <Loader2 size={11} className="spin" />
                                  <tl.icon size={12} /> {tl.label}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Message content */}
                      <div style={{
                        background: msg.isError ? 'rgba(229,57,53,0.06)' : 'var(--bg-card)',
                        border: `1px solid ${msg.isError ? 'rgba(229,57,53,0.25)' : 'var(--border)'}`,
                        borderRadius: '4px 16px 16px 16px',
                        padding: '12px 16px',
                      }}>
                        {msg.isError ? (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--loss)', fontSize: 13.5 }}>
                            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{msg.content}</span>
                          </div>
                        ) : msg.content ? (
                          <MessageContent content={msg.content} />
                        ) : msg.isStreaming ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                            {[0, 1, 2].map(i => (
                              <span key={i} style={{
                                width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)',
                                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                display: 'inline-block',
                              }} />
                            ))}
                          </div>
                        ) : null}

                        {/* Streaming cursor */}
                        {msg.isStreaming && msg.content && (
                          <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--brand)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Rate limit warning ─────────────────────────────────────── */}
      {isAtLimit && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 10, padding: '10px 14px', background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <Lock size={14} color="var(--loss)" />
            <span style={{ color: 'var(--tx-2)' }}>
              You've used your <strong>{planLimit}</strong> AI messages for this window.
              {plan === 'free' && ' Free plan: 3 messages/minute.'}
            </span>
          </div>
          <button onClick={() => navigate('/app/settings')}
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={12} /> Upgrade
          </button>
        </motion.div>
      )}

      {/* ── Input area ────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '12px 14px', flexShrink: 0 }}>
        {/* Quick prompts row (compact, shown when there are messages) */}
        {messages.length > 0 && messages.length < 20 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {QUICK_PROMPTS.slice(0, 4).map(qp => (
              <button key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={isStreaming || isAtLimit}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-3)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', opacity: (isStreaming || isAtLimit) ? 0.5 : 1, transition: 'all 150ms', whiteSpace: 'nowrap' }}>
                <qp.icon size={13} style={{ flexShrink: 0 }} /> {qp.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isAtLimit}
            placeholder={
              isAtLimit
                ? `Upgrade to ${plan === 'free' ? 'Premium' : 'Pro'} for more messages…`
                : isMobile
                  ? 'Ask about any NSE stock…'
                  : 'Ask about any NSE stock — e.g. "Is TCS undervalued?" or "Explain MACD"…'
            }
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--tx)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'none',
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: 'auto',
              outline: 'none',
              opacity: (isStreaming || isAtLimit) ? 0.6 : 1,
              transition: 'border-color 150ms',
            }}
            onFocus={e => { if (!isAtLimit) e.currentTarget.style.borderColor = 'var(--border-brand)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            onInput={e => {
              // auto-grow
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || isAtLimit}
            className="btn-primary btn-glow"
            style={{ padding: '10px 14px', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!input.trim() || isStreaming || isAtLimit) ? 0.5 : 1, transition: 'opacity 150ms' }}
          >
            {isStreaming ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 8, textAlign: 'center' }}>
          Educational purposes only — not investment advice · SEBI-registered advisor recommended
        </p>
      </div>
    </motion.div>
  );
}
