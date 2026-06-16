"use client";

// Mini price-trend sparkline. Convention matches the original dashboard:
// rising price = red (bad for us), falling = green (good), flat = gray.
export default function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.filter((v): v is number => v != null);
  if (pts.length < 2) return <span className="muted">—</span>;

  const W = 80;
  const H = 24;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = W / (pts.length - 1);
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 6);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  const first = pts[0];
  const last = pts[pts.length - 1];
  const color = last > first ? "#c0392b" : last < first ? "#2d8a2d" : "#9aa6ae";

  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={(pts.length - 1) * step} cy={y(last)} r="2" fill={color} />
    </svg>
  );
}
