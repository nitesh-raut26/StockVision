/**
 * ShareButton — shares a stock's public Conviction Card (the viral-growth loop).
 *
 * Uses the Web Share API on mobile; falls back to copying the public /stock/:ticker
 * link to the clipboard on desktop. That public page is the SEO funnel — a friend
 * lands on it, sees the AI conviction breakdown, and signs up.
 */
import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface Props {
  ticker: string;
  score: number;
}

export default function ShareButton({ ticker, score }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/stock/${ticker}`;
    const title = `${ticker} — AI Conviction ${score}/10 | StockVision`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled the share sheet — no-op */
    }
  };

  return (
    <button
      onClick={handleShare}
      title="Share conviction card"
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12,
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        color: copied ? 'var(--gain)' : 'var(--tx-2)', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms',
      }}
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
