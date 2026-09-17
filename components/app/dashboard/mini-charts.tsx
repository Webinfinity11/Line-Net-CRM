import type { SystemType } from "@/db/schema";
import { SYSTEM_LABELS } from "@/lib/i18n";
import { JobIcon } from "./job-icon";

/** Tiny inline trend line. Pure SVG: no library, no layout shift. */
export function Sparkline({ values, color = "#3457d5", width = 96, height = 26 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const y = (v: number) => height - 3 - (v / max) * (height - 6);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <polygon points={area} fill={color} fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={y(values[values.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}

function Bar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="h-[7px] overflow-hidden rounded-full bg-[#f1f4f9]">
      <div className="ln-bar h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: color, animationDelay: `${delay}ms` }} />
    </div>
  );
}

/** Orders per system, with the system's own icon on each row. */
export function SystemBars({ rows }: { rows: { system: SystemType | null; n: number }[] }) {
  if (rows.length === 0) return <p className="py-8 text-center text-[12.5px] text-muted-foreground">ამ პერიოდში შეკვეთა არ არის</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.system ?? "other"} className="flex items-center gap-3">
          <JobIcon system={r.system} className="size-8 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px]">{r.system ? SYSTEM_LABELS[r.system] : "სისტემის გარეშე"}</span>
              <span className="tabular shrink-0 text-[12.5px] font-semibold">{r.n}</span>
            </div>
            <Bar pct={(r.n / max) * 100} color="#3457d5" delay={i * 70} />
          </div>
        </li>
      ))}
    </ul>
  );
}
