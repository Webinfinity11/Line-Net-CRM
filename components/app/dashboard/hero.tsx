"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { CountUp, DrawnArea } from "@/components/app/motion";
import { formatMoney } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";

/**
 * The head of the dashboard. It belongs to the same family as every other card —
 * white on the page grey — because a dark slab here read as a piece of a different
 * product. The month's money is still the headline, with the last two weeks beside it.
 */
export function DashboardHero({
  greeting,
  dateLine,
  revenue,
  changePct,
  lastMonth,
  cash,
  children,
}: {
  greeting: string;
  dateLine: string;
  revenue: number;
  changePct: number | null;
  lastMonth: number;
  cash: { day: string; amount: number }[];
  children?: React.ReactNode;
}) {
  const up = (changePct ?? 0) > 0;
  const flat = changePct === 0;
  const Icon = changePct === null || flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <section className="ln-card p-5 sm:p-6 max-md:p-4" aria-label="თვის შედეგი">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-heading max-md:text-[21px] text-[24px] leading-[1.25] tracking-[-0.4px] sm:text-[26px]">{toMtavruli(greeting)}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{dateLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:flex-nowrap max-md:gap-1">{children}</div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t border-[#eef1f6] pt-5">
        <div className="min-w-0">
          <div className="text-[11.5px] text-muted-foreground">ამ თვეში მიღებული</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <CountUp value={revenue} format={formatMoney} className="font-heading text-[32px] font-bold leading-none tracking-[-0.9px] sm:text-[38px]" />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
                changePct === null || flat ? "bg-[#f1f4f9] text-muted-foreground" : up ? "bg-[#eaf6ef] text-[#25815a]" : "bg-[#faeeee] text-[#b13f32]",
              )}
            >
              <Icon className="size-3.5" />
              {changePct === null ? "შედარება ვერ ითვლება" : flat ? "უცვლელი" : `${up ? "+" : ""}${changePct}%`}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">გასულ თვეს იმავე დღისთვის {formatMoney(lastMonth)}</p>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-[380px] max-md:w-full max-md:flex-none max-md:max-w-none">
          <div className="mb-1 flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>ბოლო 14 დღე</span>
            <span className="tabular">{formatMoney(cash.reduce((s, c) => s + c.amount, 0))}</span>
          </div>
          <DrawnArea points={cash.map((c) => c.amount)} height={56} stroke="#3457d5" fill="#3457d5" />
        </div>
      </div>
    </section>
  );
}
