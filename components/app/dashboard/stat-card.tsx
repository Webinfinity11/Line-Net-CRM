import { ArrowUpRight, ArrowDownRight, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type Trend = { pct: number; label: string } | null;

function TrendChip({ trend, filled }: { trend: NonNullable<Trend>; filled: boolean }) {
  const up = trend.pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-medium",
        filled ? "bg-white/20 text-white" : up ? "bg-[#eaf6ef] text-[#25815a]" : "bg-[#fff0ed] text-[#b13f32]",
      )}
      title={trend.label}
    >
      <Icon className="size-3 [stroke-width:2]" />
      {up ? "+" : ""}
      {trend.pct}%
    </span>
  );
}

/** Airy metric card: label, drill-down arrow, large number, optional honest trend, caption. */
export function StatCard({
  label,
  value,
  caption,
  href,
  trend = null,
  filled = false,
}: {
  label: string;
  value: number | string;
  caption: string;
  href: string;
  trend?: Trend;
  filled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group ln-card-link flex min-h-[148px] flex-col justify-between rounded-[20px] p-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]",
        filled ? "bg-[#3457d5] text-white shadow-[0_10px_26px_rgba(52,87,213,0.28)]" : "ln-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-[12.5px] leading-snug", filled ? "text-white/85" : "text-muted-foreground")}>{label}</span>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:-translate-y-0.5",
            filled ? "bg-white/20 text-white" : "bg-[#f1f4f9] text-[#566b7d] group-hover:bg-[#eef2ff] group-hover:text-[#3457d5]",
          )}
          aria-hidden
        >
          <ArrowUpRight className="size-4 [stroke-width:1.8]" />
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <strong className={cn("tabular font-heading text-[34px] font-semibold leading-none tracking-[-1px]", filled ? "text-white" : "text-foreground")}>{value}</strong>
        {trend && <TrendChip trend={trend} filled={filled} />}
      </div>
      <span className={cn("mt-2 text-[11px]", filled ? "text-white/70" : "text-muted-foreground")}>{caption}</span>
    </Link>
  );
}

/** Large "N awaiting" card: icon, big number with a word, and a sentence with the key part highlighted. */
export function AwaitingCard({
  value,
  unit,
  sentence,
  highlight,
  href,
  icon: Icon,
  tone,
}: {
  value: number;
  unit: string;
  sentence: [string, string];
  highlight: string;
  href: string;
  icon: typeof ArrowDownRight;
  tone: { bg: string; fg: string };
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between ln-card p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#c9d3e3] hover:shadow-[0_8px_22px_rgba(38,57,104,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]"
    >
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-full" style={{ background: tone.bg, color: tone.fg }}>
          <Icon className="size-[18px] [stroke-width:1.8]" />
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f1f4f9] text-[#566b7d] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:bg-[#eef2ff] group-hover:text-[#3457d5]" aria-hidden>
          <ArrowUpRight className="size-4 [stroke-width:1.8]" />
        </span>
      </div>
      <div className="relative mt-6 flex items-baseline gap-2">
        <strong className="tabular font-heading text-[40px] font-semibold leading-none tracking-[-1.2px]">{value}</strong>
        <span className="text-[15px] text-muted-foreground">{unit}</span>
      </div>
      <p className="relative mt-2 text-[12px] text-muted-foreground">
        {sentence[0]} <span style={{ color: tone.fg }}>{highlight}</span> {sentence[1]}
      </p>
    </Link>
  );
}
