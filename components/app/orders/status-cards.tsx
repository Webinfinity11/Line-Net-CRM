import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { OrderStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type StatusFlow = { now: number; prev: number };

const CARDS: { key: OrderStatus; tint: string; flow?: "created" | "completed"; caption?: string }[] = [
  { key: "new", tint: "#dbe7ff", flow: "created", caption: "ამ კვირას შემოვიდა" },
  { key: "assigned", tint: "#ece5fb" },
  { key: "in_progress", tint: "#ffeccc" },
  { key: "done", tint: "#d8f0e3", flow: "completed", caption: "ამ კვირას შესრულდა" },
];

function Trend({ flow }: { flow: StatusFlow }) {
  // only a real previous week gives an honest percentage
  if (flow.prev <= 0) return null;
  const pct = Math.round(((flow.now - flow.prev) / flow.prev) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <div className="text-right">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
          up ? "bg-[#eaf6ef] text-[#25815a]" : "bg-[#fff0ed] text-[#b13f32]",
        )}
      >
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(pct)}%
      </span>
      <div className="mt-1 text-[11px] text-muted-foreground">წინა კვირასთან</div>
    </div>
  );
}

/** Four status summary cards above the list; each one filters the table. */
export function StatusCards({
  counts,
  flow,
  activeStatus,
  hrefFor,
}: {
  counts: Partial<Record<OrderStatus, number>>;
  flow: { created: StatusFlow; completed: StatusFlow };
  activeStatus?: string;
  hrefFor: (status: OrderStatus) => string;
}) {
  return (
    <div className="grid grid-cols-2 max-md:grid-cols-2 max-md:gap-1.5 gap-2.5 sm:gap-3 xl:grid-cols-4">
      {CARDS.map((c) => {
        const f = c.flow ? flow[c.flow] : null;
        return (
          <Link
            key={c.key}
            href={hrefFor(c.key)}
            aria-current={activeStatus === c.key ? "page" : undefined}
            className={cn(
              "overflow-hidden ln-card max-md:min-w-0 max-md:rounded-[12px] max-md:flex max-md:min-h-[44px] max-md:items-center max-md:justify-between max-md:gap-1 max-md:px-3 transition-[box-shadow,border-color] duration-150 hover:border-[#c9d3e3] hover:shadow-[0_4px_14px_rgba(38,57,104,0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]",
              activeStatus === c.key && "border-[#3457d5] ring-2 ring-[#3457d5]",
            )}
          >
            <div className="truncate max-md:overflow-visible max-md:whitespace-nowrap max-md:px-0 max-md:py-2 max-md:text-[11px] max-md:!bg-transparent px-3 py-2 text-[12px] font-medium text-[#17212b] sm:px-4" style={{ background: c.tint }}>
              {STATUS_LABELS[c.key]}
            </div>
            <div className="flex max-md:justify-center max-md:px-1 max-md:py-2 items-end justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <div className="tabular max-md:text-center max-md:text-[16px] font-heading text-[24px] font-bold leading-none text-foreground sm:text-[28px]">{counts[c.key] ?? 0}</div>
                <div className="max-md:hidden mt-1.5 truncate text-[11px] text-muted-foreground">{f && c.caption ? `${c.caption} ${f.now}` : "მიმდინარე ჯამი"}</div>
              </div>
              {f ? <div className="hidden md:block">{<Trend flow={f} />}</div> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
