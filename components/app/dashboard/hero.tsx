"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { CountUp, DrawnArea } from "@/components/app/motion";
import { formatMoney } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";

/**
 * The first thing on the dashboard: this month's money, how it compares with last
 * month, and the shape of the last two weeks. The drifting glow behind it is two
 * blurred blobs moved with `transform`, so it costs the compositor and nothing else.
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
    <section className="ln-hero relative isolate overflow-hidden rounded-[24px] px-6 py-6 sm:px-8 sm:py-7" aria-label="თვის შედეგი">
      <span aria-hidden className="ln-blob ln-blob-a" />
      <span aria-hidden className="ln-blob ln-blob-b" />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div className="w-full min-w-0 sm:w-auto">
          <h1 className="font-heading text-[26px] font-semibold leading-[1.25] tracking-[-0.5px] text-white sm:text-[30px]">{toMtavruli(greeting)}</h1>
          <p className="mt-1 text-[13px] text-white/60">{dateLine}</p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <CountUp
              value={revenue}
              format={formatMoney}
              className="font-heading text-[38px] font-bold leading-none tracking-[-1.2px] text-white sm:text-[46px]"
            />
            <span
              className={cn(
                "mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
                changePct === null || flat ? "bg-white/10 text-white/70" : up ? "bg-[#2f9e6b]/20 text-[#7fe3b4]" : "bg-[#d9614f]/20 text-[#ffb3a5]",
              )}
            >
              <Icon className="size-3.5" />
              {changePct === null ? "პირველი თვე" : flat ? "უცვლელი" : `${up ? "+" : ""}${changePct}%`}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-white/50">
            ამ თვეში მიღებული · გასულ თვეს {formatMoney(lastMonth)}
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col items-stretch gap-4 sm:w-auto sm:flex-1 sm:max-w-[420px]">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
          <div className="rounded-[16px] bg-white/[0.06] p-3 backdrop-blur-sm">
            <div className="mb-1 flex items-center justify-between text-[11px] text-white/55">
              <span>ბოლო 14 დღე</span>
              <span className="tabular">{formatMoney(cash.reduce((s, c) => s + c.amount, 0))}</span>
            </div>
            <DrawnArea points={cash.map((c) => c.amount)} height={64} stroke="#8fb4ff" fill="#8fb4ff" />
          </div>
        </div>
      </div>
    </section>
  );
}
