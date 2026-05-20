interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function ConvictionBadge({ score, size = 'md' }: Props) {
  const dims = { sm: { outer: 36, inner: 26, font: 11 }, md: { outer: 44, inner: 32, font: 13 }, lg: { outer: 60, inner: 44, font: 17 } };
  const d = dims[size];

  const color =
    score >= 8 ? { ring: '#00C896', glow: 'rgba(0,200,150,0.3)',  bg: 'rgba(0,200,150,0.1)',  tx: '#00C896' } :
    score >= 6 ? { ring: '#F5A623', glow: 'rgba(245,166,35,0.3)', bg: 'rgba(245,166,35,0.1)', tx: '#F5A623' } :
                 { ring: '#FF4D6A', glow: 'rgba(255,77,106,0.3)', bg: 'rgba(255,77,106,0.1)', tx: '#FF4D6A' };

  return (
    <div style={{ position: 'relative', width: d.outer, height: d.outer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {/* Outer ring */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${color.ring}`, boxShadow: `0 0 10px ${color.glow}` }} />
      {/* Inner fill */}
      <div style={{ width: d.inner, height: d.inner, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: d.font, fontWeight: 800, color: color.tx, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
