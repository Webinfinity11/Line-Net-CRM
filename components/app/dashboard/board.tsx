"use client";

import { ArrowRight, ArrowUpRight, CalendarDays, Mail, MailX, Siren, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/app/user-avatar";
import { formatMoney } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";
import { OrderDrawer } from "./order-drawer";
import type { BoardOrder, Executor, MailPeek, Visit, WorkloadRow } from "./types";

const ACTIVE = new Set(["new", "assigned", "in_progress"]);
const card = "rounded-[20px] border border-border bg-white p-5";
const cardTitle = "flex items-center gap-2 font-heading text-[13px] font-medium";

/** Operational row of the dashboard: what needs attention, today's visits, team load, money. */
export function DashboardBoard({
  orders,
  visits,
  visitsTotal,
  executors,
  workload,
  normHours,
  today,
  mail,
  money,
}: {
  orders: BoardOrder[];
  visits: Visit[];
  visitsTotal: number;
  executors: Executor[];
  workload: WorkloadRow[];
  normHours: number;
  today: string;
  mail: MailPeek;
  money: { paid: number; unpaid: number; periodLabel: string };
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const urgent = useMemo(() => orders.filter((o) => o.priority === "urgent" && o.assignees.length === 0 && ACTIVE.has(o.status)), [orders]);
  const byId = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const collected = money.paid + money.unpaid;
  const paidPct = collected > 0 ? Math.round((money.paid / collected) * 100) : 0;

  return (
    <div className="space-y-4">
      {urgent.length > 0 && (
        <div className="ln-panel-in flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-[#f4e2d7] bg-[#fff6f1] px-4 py-3 text-[12.5px] text-[#a84630]" role="status">
          <span className="flex min-w-0 items-center gap-2">
            <Siren className="size-4 shrink-0 [stroke-width:1.7]" />
            <span className="truncate">
              სასწრაფო დაუნიშნავი · {urgent[0].title}
              {urgent.length > 1 && <span className="ml-1 rounded bg-white/70 px-1.5 py-0.5 text-[11px]">+{urgent.length - 1}</span>}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedId(urgent[0].id)}
            className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#98452f] transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[#a84630]"
          >
            დანიშვნა <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      <div className="ln-stagger grid gap-4 lg:grid-cols-3">
        <section className={cn(card, "min-w-0 text-[12.5px]")} aria-label="დღევანდელი ვიზიტები">
          <h3 className={cardTitle}>
            <CalendarDays className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("დღევანდელი ვიზიტები")}
          </h3>
          <div className="mt-3">
            {visits.length === 0 && <p className="py-3 text-muted-foreground">დღეს დაგეგმილი ვიზიტი არ არის</p>}
            {visits.map((v) => {
              const body = (
                <>
                  <span className="text-foreground">{v.client}</span>
                  <small className="mt-[3px] block text-[11px] text-muted-foreground">
                    {v.executor} · {v.site}
                  </small>
                </>
              );
              return (
                <div key={v.id} className="grid grid-cols-[44px_1fr] gap-2 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                  <time className="font-medium text-[#3457d5]">{v.time}</time>
                  {byId.has(v.id) ? (
                    <button type="button" onClick={() => setSelectedId(v.id)} className="min-w-0 text-left transition-colors hover:text-[#3457d5] focus-visible:outline-2 focus-visible:outline-[#3457d5]">
                      {body}
                    </button>
                  ) : (
                    <Link href={`/orders/${v.id}`} className="min-w-0 text-left transition-colors hover:text-[#3457d5]">
                      {body}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>
              ნაჩვენებია {visits.length} / {visitsTotal} ვიზიტი
            </span>
            <Link href="/schedule" className="inline-flex items-center gap-1 text-[#3457d5] hover:underline">
              განრიგი <ArrowRight className="size-3" />
            </Link>
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[11.5px]">
            {mail.configured ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Mail className="size-4 text-muted-foreground [stroke-width:1.7]" /> შემოსულები
                </span>
                <Link href="/inbox" className="inline-flex items-center gap-1 text-[11px] text-[#3457d5] hover:underline">
                  {mail.count} წერილი <ArrowUpRight className="size-3" />
                </Link>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MailX className="size-4 [stroke-width:1.7]" /> ფოსტა არ არის დაკავშირებული
                </span>
                <Link href={mail.connectHref} className="inline-flex items-center gap-1 text-[11px] text-[#3457d5] hover:underline">
                  დაკავშირება <ArrowUpRight className="size-3" />
                </Link>
              </>
            )}
          </div>
        </section>

        <section className={cn(card, "min-w-0")} aria-label="გუნდის დატვირთვა">
          <h3 className={cardTitle}>
            <Users className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("გუნდის დატვირთვა")}
          </h3>
          <div className="mt-3">
            {workload.length === 0 && <p className="py-2 text-[12.5px] text-muted-foreground">შემსრულებლები არ არიან დამატებული</p>}
            {workload.map((w) => {
              const pct = normHours > 0 ? Math.min(100, Math.round((w.hours / normHours) * 100)) : 0;
              const over = w.hours > normHours;
              const fill = over ? "#c75e50" : pct > 75 ? "#bd9c56" : "#3457d5";
              return (
                <div key={w.id} className="mb-3.5 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[12.5px]">
                      <UserAvatar name={w.name} image={w.image} size="sm" /> {w.name}
                    </span>
                    <span className={cn("tabular text-[11.5px] text-muted-foreground", over && "font-medium text-[#c75e50]")}>
                      {w.hours} / {normHours} სთ
                    </span>
                  </div>
                  <div className="h-[6px] overflow-hidden rounded-full bg-[#eef1f6]" role="img" aria-label={`${w.name}, დაგეგმილია ${w.hours} საათი ${normHours} საათიდან`}>
                    <i className="block h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${pct}%`, background: fill }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">დაგეგმილი დრო · დღეს</p>
        </section>

        <section className={cn(card, "min-w-0")} aria-label="თანხები">
          <h3 className={cardTitle}>
            <Wallet className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("თანხები")}
          </h3>
          <div className="mt-4">
            <div className="text-[11px] text-muted-foreground">მიღებული · {money.periodLabel}</div>
            <div className="tabular mt-1 font-heading text-[28px] font-medium leading-none tracking-[-0.8px] text-[#25815a]">{formatMoney(money.paid)}</div>
          </div>
          <div className="mt-4 rounded-[14px] bg-[#fff8f6] p-3">
            <div className="text-[11px] text-muted-foreground">გადაუხდელი ნაშთი · ყველა შეკვეთა</div>
            <div className="tabular mt-1 font-heading text-[19px] font-medium text-[#a84630]">{formatMoney(money.unpaid)}</div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-muted-foreground">გადახდის მაჩვენებელი</span>
              <span className="tabular font-medium">{paidPct}%</span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-[#eef1f6]">
              <div className="h-full rounded-full bg-[#25815a] transition-[width] duration-300" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        </section>
      </div>

      <OrderDrawer order={selected} executors={executors} normHours={normHours} today={today} onClose={() => setSelectedId(null)} />
    </div>
  );
}
