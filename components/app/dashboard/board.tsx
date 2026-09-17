"use client";

import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Mail, MailX, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/app/user-avatar";
import { STATUS_HEX, STATUS_TINT } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";
import { OrderDrawer } from "./order-drawer";
import type { BoardOrder, Executor, MailPeek, TodayBlock, WorkloadRow } from "./types";

const ACTIVE = new Set(["new", "assigned", "in_progress"]);

/** Fixed working window for the day strip. */
const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const SPAN = DAY_END - DAY_START;
const HOURS = [8, 10, 12, 14, 16, 18, 20];

function Counter({
  label,
  value,
  href,
  onClick,
  alert,
}: {
  label: string;
  value: number;
  href?: string;
  onClick?: () => void;
  alert?: boolean;
}) {
  const body = (
    <>
      <span className={cn("tabular font-heading text-[22px] font-semibold leading-none", alert && value > 0 ? "text-[#b13f32]" : "text-foreground")}>{value}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </>
  );
  const cls =
    "flex min-w-[104px] flex-col gap-1.5 rounded-[14px] px-4 py-3 text-left transition-colors duration-150 hover:bg-[#f1f4f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className={cls}>
      {body}
    </Link>
  );
}

/**
 * The dashboard's interactive island: one action bar, one day strip, one day summary.
 * Everything that can open an order shares a single drawer.
 */
export function DashboardBoard({
  orders,
  blocks,
  lanes,
  executors,
  workload,
  normHours,
  today,
  mail,
  counts,
}: {
  orders: BoardOrder[];
  blocks: TodayBlock[];
  lanes: { id: string; name: string; image: string | null }[];
  executors: Executor[];
  workload: WorkloadRow[];
  normHours: number;
  today: string;
  mail: MailPeek;
  counts: { unassigned: number; overdue: number; review: number; visits: number; completedToday: number };
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const urgent = useMemo(() => orders.filter((o) => o.priority === "urgent" && o.assignees.length === 0 && ACTIVE.has(o.status)), [orders]);
  // one thing to act on: the urgent unassigned job, otherwise the oldest overdue one
  const focus = useMemo(() => {
    if (urgent.length > 0) return { order: urgent[0], kind: "urgent" as const, more: urgent.length - 1 };
    const late = orders.filter((o) => o.overdue && ACTIVE.has(o.status));
    if (late.length > 0) return { order: late[0], kind: "overdue" as const, more: late.length - 1 };
    return null;
  }, [orders, urgent]);
  const hoursOf = useMemo(() => new Map(workload.map((w) => [w.id, w.hours])), [workload]);
  const calm = counts.unassigned === 0 && counts.overdue === 0 && counts.review === 0 && urgent.length === 0;
  const laneRows = [...(blocks.some((b) => b.laneId === "unassigned") ? [{ id: "unassigned", name: "დაუნიშნავი", image: null }] : []), ...lanes];

  return (
    <div className="space-y-4">
      {/* zone 1 — what needs a decision now */}
      <section className="ln-card ln-enter flex flex-wrap items-center justify-between gap-4 p-4" aria-label="მოქმედება სჭირდება">
        <div className="flex flex-wrap items-center gap-1">
          <span className="px-3 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">{toMtavruli("მოქმედება სჭირდება")}</span>
          <Counter label="დაუნიშნავი" value={counts.unassigned} href="/schedule" alert />
          <Counter label="ვადაგადაცილებული" value={counts.overdue} href="/orders?overdue=1" alert />
          <Counter label="ჩასაბარებელი" value={counts.review} href="/orders?status=done" />
        </div>
        {calm ? (
          <p className="flex items-center gap-2 rounded-full bg-[#eaf6ef] px-4 py-2 text-[12px] text-[#25815a]">
            <CheckCircle2 className="size-4 [stroke-width:1.8]" /> ყველა შეკვეთა დანიშნულია
          </p>
        ) : focus ? (
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <span className="size-2 shrink-0 rounded-full bg-[#b13f32]" />
              <span className="truncate">
                <span className="text-[#b13f32]">{focus.kind === "urgent" ? "სასწრაფო:" : "ვადაგადაცილებული:"}</span> {focus.order.title}
                {focus.more > 0 && <span className="ml-1 text-muted-foreground">+{focus.more}</span>}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedId(focus.order.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#3457d5] px-4 py-2 font-heading text-[13px] font-bold tracking-[-0.005em] text-white transition-colors hover:bg-[#2846b7]"
            >
              <UserPlus className="size-3.5" /> {toMtavruli(focus.kind === "urgent" ? "დანიშვნა" : "გახსნა")}
            </button>
          </div>
        ) : null}
      </section>

      {/* zone 2 — the day */}
      <div className="ln-enter ln-enter-2 grid items-start gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <section className="ln-card min-w-0 p-6" aria-label="დღევანდელი განრიგი">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[15px] font-semibold">{toMtavruli("დღევანდელი განრიგი")}</h2>
            <Link href="/schedule" className="inline-flex items-center gap-1 text-[11.5px] text-[#3457d5] hover:underline">
              სრული განრიგი <ArrowRight className="size-3" />
            </Link>
          </div>

          {laneRows.length === 0 || blocks.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#e6ebf2] px-4 py-6 text-center">
              <p className="text-[12.5px] text-muted-foreground">დღეს დაგეგმილი ვიზიტი არ არის.</p>
              <Link href="/schedule" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#3457d5] hover:underline">
                დაგეგმე დღე <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="ml-[128px] flex justify-between border-b border-[#eef1f6] pb-1.5 text-[10px] text-muted-foreground">
                {HOURS.map((h) => (
                  <span key={h}>{String(h).padStart(2, "0")}:00</span>
                ))}
              </div>
              <ul className="mt-1">
                {laneRows.map((lane) => {
                  const mine = blocks.filter((b) => b.laneId === lane.id);
                  const hours = hoursOf.get(lane.id);
                  return (
                    <li key={lane.id} className="flex items-center gap-3 border-b border-[#f4f6fa] py-2 last:border-0">
                      <span className="flex w-[116px] shrink-0 items-center gap-2">
                        {lane.id === "unassigned" ? (
                          <span className="grid size-7 place-items-center rounded-full bg-[#fff0ed] text-[#b13f32]">
                            <Clock3 className="size-3.5 [stroke-width:1.8]" />
                          </span>
                        ) : (
                          <UserAvatar name={lane.name} image={lane.image} size="md" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[12px]">{lane.name.split(" ")[0]}</span>
                          {hours !== undefined && (
                            <span className={cn("tabular block text-[10px]", hours > normHours ? "text-[#b13f32]" : "text-muted-foreground")}>
                              {hours}/{normHours} სთ
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="relative h-9 min-w-0 flex-1 rounded-[10px] bg-[#f8fafd]">
                        {mine.map((b, i) => {
                          const left = ((b.startMin - DAY_START) / SPAN) * 100;
                          const width = (b.minutes / SPAN) * 100;
                          return (
                            <button
                              key={`${b.id}-${b.laneId}`}
                              type="button"
                              onClick={() => setSelectedId(b.id)}
                              title={`${b.timeLabel} · ${b.title}${b.client ? ` · ${b.client}` : ""}`}
                              className="ln-pop absolute top-1 flex h-7 items-center gap-1.5 overflow-hidden rounded-[8px] px-2 text-left text-[11px] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(16,24,40,0.16)] focus-visible:outline-2 focus-visible:outline-[#3457d5]"
                              style={{
                                animationDelay: `${Math.min(i, 8) * 40 + 120}ms`,
                                left: `${Math.max(0, Math.min(97, left))}%`,
                                width: `${Math.max(6, Math.min(100 - Math.max(0, left), width))}%`,
                                background: STATUS_TINT[b.status],
                                borderLeft: `3px solid ${STATUS_HEX[b.status]}`,
                              }}
                            >
                              <span className="truncate">
                                <span className="tabular text-muted-foreground">{b.timeLabel}</span> {b.title}
                              </span>
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="ln-card min-w-0 p-6" aria-label="დღევანდელი შედეგი">
          <h2 className="mb-5 font-heading text-[15px] font-semibold">{toMtavruli("დღევანდელი დღე")}</h2>
          <dl className="space-y-4">
            {[
              { icon: CalendarDays, label: "დაგეგმილი ვიზიტი", value: counts.visits },
              { icon: CheckCircle2, label: "ჩაბარებული სამუშაო", value: counts.completedToday },
              { icon: UserPlus, label: "ელოდება დანიშვნას", value: counts.unassigned },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#f1f4f9] text-[#566b7d]">
                  <row.icon className="size-[18px] [stroke-width:1.7]" />
                </span>
                <dt className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">{row.label}</dt>
                <dd className="tabular font-heading text-[20px] font-semibold leading-none">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#eef1f6] pt-4 text-[12px]">
            {mail.configured ? (
              <>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-4 [stroke-width:1.7]" /> შემოსული წერილები
                </span>
                <Link href="/inbox" className="tabular font-medium text-[#3457d5] hover:underline">
                  {mail.count}
                </Link>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MailX className="size-4 [stroke-width:1.7]" /> ფოსტა არ არის დაკავშირებული
                </span>
                <Link href={mail.connectHref} className="font-medium text-[#3457d5] hover:underline">
                  დაკავშირება
                </Link>
              </>
            )}
          </div>
        </section>
      </div>

      <OrderDrawer order={selected} executors={executors} normHours={normHours} today={today} onClose={() => setSelectedId(null)} />
    </div>
  );
}
