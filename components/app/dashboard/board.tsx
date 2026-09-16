"use client";

import { ArrowRight, ArrowUpRight, CalendarDays, CircleCheck, ClipboardList, Mail, MailX, Siren, TriangleAlert, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/app/badges";
import { UserAvatar } from "@/components/app/user-avatar";
import { cn } from "@/lib/utils";
import { JobIcon } from "./job-icon";
import { OrderDrawer } from "./order-drawer";
import type { BoardFilter, BoardOrder, Executor, MailPeek, Visit, WorkloadRow } from "./types";
import { toMtavruli } from "@/lib/mtavruli";

/** The board is a short working list; the full list lives on /orders. */
const MAX_ROWS = 8;

const FILTERS: { key: BoardFilter; label: string }[] = [
  { key: "all", label: "ყველა" },
  { key: "unassigned", label: "დაუნიშნავი" },
  { key: "overdue", label: "ვადაგადაცილებული" },
  { key: "review", label: "ჩასაბარებელი" },
];

const ACTIVE = new Set(["new", "assigned", "in_progress"]);

function firstName(name: string) {
  return name.split(" ")[0];
}

function matches(o: BoardOrder, f: BoardFilter) {
  if (f === "unassigned") return o.assignees.length === 0 && ACTIVE.has(o.status);
  if (f === "overdue") return o.overdue;
  if (f === "review") return o.status === "done";
  return true;
}

const metricTile =
  "group flex flex-col rounded-[11px] border border-border bg-white p-[14px] text-left transition-[border-color,box-shadow] duration-150 hover:border-[#a5b5ed] hover:shadow-[0_4px_14px_rgba(38,57,104,0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]";

function MetricBody({ value, label, icon: Icon, bg, fg }: { value: number; label: string; icon: typeof ClipboardList; bg: string; fg: string }) {
  return (
    <>
      <div className="mb-[13px] flex items-center justify-between">
        <strong className="tabular font-heading text-[27px] font-medium leading-[1.2] tracking-[-0.6px] text-foreground">{value}</strong>
        <span className="grid size-[30px] place-items-center rounded-lg" style={{ background: bg, color: fg }}>
          <Icon className="size-4 [stroke-width:1.7]" />
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </>
  );
}

export function DashboardBoard({
  metrics,
  orders,
  visits,
  visitsTotal,
  executors,
  workload,
  normHours,
  today,
  mail,
}: {
  metrics: { active: number; visits: number; overdue: number; review: number };
  orders: BoardOrder[];
  visits: Visit[];
  visitsTotal: number;
  executors: Executor[];
  workload: WorkloadRow[];
  normHours: number;
  today: string;
  mail: MailPeek;
}) {
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const filtered = useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);
  const rows = filtered.slice(0, MAX_ROWS);
  const urgent = useMemo(() => orders.filter((o) => o.priority === "urgent" && o.assignees.length === 0 && ACTIVE.has(o.status)), [orders]);
  const byId = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  return (
    <div className="space-y-5">
      {/* metrics */}
      <div className="ln-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" className={metricTile} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>
          <MetricBody value={metrics.active} label="აქტიური შეკვეთები · მიმდინარე ჯამი" icon={ClipboardList} bg="#edf2ff" fg="#3457d5" />
        </button>
        <Link href="/schedule" className={metricTile}>
          <MetricBody value={metrics.visits} label="დღევანდელი ვიზიტები" icon={CalendarDays} bg="#fff3df" fg="#a96308" />
        </Link>
        <button type="button" className={metricTile} onClick={() => setFilter("overdue")} aria-pressed={filter === "overdue"}>
          <MetricBody value={metrics.overdue} label="ვადაგადაცილებული · მიმდინარე ჯამი" icon={TriangleAlert} bg="#fff0ed" fg="#b13f32" />
        </button>
        <button type="button" className={metricTile} onClick={() => setFilter("review")} aria-pressed={filter === "review"}>
          <MetricBody value={metrics.review} label="ჩასაბარებელი · ელოდება შემოწმებას" icon={CircleCheck} bg="#eaf6ef" fg="#25815a" />
        </button>
      </div>

      {/* attention row */}
      {urgent.length > 0 && (
        <div className="ln-panel-in flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#f4e2d7] bg-[#fff6f1] px-[13px] py-[11px] text-[12px] text-[#a84630]" role="status">
          <span className="flex min-w-0 items-center gap-2">
            <Siren className="size-4 shrink-0 [stroke-width:1.7]" />
            <span className="truncate">
              სასწრაფო დაუნიშნავი · {urgent[0].title}
              {urgent.length > 1 && <span className="ml-1 rounded bg-white/70 px-1 py-0.5 text-[11px]">+{urgent.length - 1}</span>}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedId(urgent[0].id)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#98452f] transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[#a84630]"
          >
            დანიშვნა <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* main grid */}
      <div className="ln-stagger grid gap-[21px] lg:grid-cols-[minmax(0,1.8fr)_minmax(190px,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-white p-[18px]" aria-label="შეკვეთები">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-[14px] font-medium">
              {toMtavruli('შეკვეთები')} <span className="ml-1 text-[11px] font-normal text-[#748197]">{toMtavruli('მოკლე სია')}</span>
            </h3>
            <span className="text-[12px] text-muted-foreground">
              {rows.length < filtered.length ? `${rows.length} / ${filtered.length}` : rows.length} ნაჩვენებია
            </span>
          </div>
          <div className="mb-[14px] flex flex-wrap gap-1.5" role="group" aria-label="ფილტრი">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className="h-8 rounded-md border border-border bg-transparent px-2.5 text-[11px] text-muted-foreground transition-colors duration-150 hover:bg-[#f8faff] aria-pressed:border-[#dbe3fd] aria-pressed:bg-[#eef2ff] aria-pressed:text-[#3457d5] focus-visible:outline-2 focus-visible:outline-[#3457d5]"
              >
                {f.label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-2 py-[30px] text-center text-[13px] text-[#617084]">
              <CircleCheck className="mx-auto mb-2 size-5 [stroke-width:1.7]" />
              <p>ამ ფილტრში შეკვეთა არ არის</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[11px] font-normal text-muted-foreground">
                  <th className="pb-[10px] pr-2 font-normal">შეკვეთა / ობიექტი</th>
                  <th className="hidden pb-[10px] pr-2 font-normal md:table-cell">შემსრულებელი</th>
                  <th className="pb-[10px] font-normal">სტატუსი</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const lead = o.assignees[0];
                  return (
                    <tr key={o.id} className="border-t border-border align-middle transition-colors duration-150 hover:bg-[#f8faff]">
                      <td className="py-[9px] pr-2">
                        <button type="button" onClick={() => setSelectedId(o.id)} className="group/row flex w-full items-start gap-[9px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5]">
                          <JobIcon system={o.systemType} />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-x-1.5">
                              <span className="font-medium text-foreground transition-colors group-hover/row:text-[#3457d5]">{o.title}</span>
                              {o.priority === "urgent" && <span className="text-[10px] font-semibold text-[#b13f32]">სასწრაფო</span>}
                            </span>
                            <small className="mt-[2px] block truncate text-[11px] text-muted-foreground">
                              {o.number}
                              {o.client ? ` · ${o.client.name}` : ""}
                            </small>
                            <small className="mt-[2px] block text-[11px] text-muted-foreground md:hidden">
                              {lead ? `${firstName(lead.name)} · ${o.timeLabel ?? "დაუგეგმავი"}` : "დაუნიშნავი"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td className="hidden whitespace-nowrap py-[9px] pr-2 md:table-cell">
                        {lead ? (
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <UserAvatar name={lead.name} image={lead.image} size="sm" />
                            {firstName(lead.name)}
                            {o.assignees.length > 1 && <span className="text-muted-foreground">+{o.assignees.length - 1}</span>}
                            <span className="text-muted-foreground">· {o.timeLabel ?? "დაუგეგმავი"}</span>
                          </span>
                        ) : ACTIVE.has(o.status) ? (
                          <button type="button" onClick={() => setSelectedId(o.id)} className="inline-flex items-center gap-1 py-1 text-[11px] text-[#3457d5] hover:underline focus-visible:outline-2 focus-visible:outline-[#3457d5]">
                            <UserPlus className="size-3.5 [stroke-width:1.7]" /> დანიშვნა
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-[9px]">
                        <StatusBadge status={o.status} />
                        {o.overdue && <small className="ml-1.5 text-[10px] font-medium text-[#b13f32]">ვადაგადაცილებული</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > rows.length && (
            <div className="border-t border-border pt-3 text-[11px]">
              <Link href={filter === "overdue" ? "/orders?overdue=1" : filter === "review" ? "/orders?status=done" : "/orders?status=active"} className="inline-flex items-center gap-1 text-[#3457d5] hover:underline">
                ყველას ნახვა <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </section>

        <aside className="min-w-0 rounded-xl border border-border bg-white p-[18px] text-[12px]" aria-label="დღევანდელი ვიზიტები და გუნდი">
          <h3 className="mb-2 flex items-center gap-[7px] font-heading text-[13px] font-medium">
            <CalendarDays className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli('დღევანდელი ვიზიტები')}
          </h3>
          {visits.length === 0 && <p className="py-[11px] text-muted-foreground">დღეს დაგეგმილი ვიზიტი არ არის</p>}
          {visits.map((v) => {
            const inBoard = byId.has(v.id);
            const body = (
              <>
                <span className="text-foreground">{v.client}</span>
                <small className="mt-[3px] block text-[11px] text-muted-foreground">
                  {v.executor} · {v.site}
                </small>
              </>
            );
            return (
              <div key={v.id} className="grid grid-cols-[40px_1fr] gap-[10px] border-t border-border py-[11px]">
                <time className="text-[#3457d5]">{v.time}</time>
                {inBoard ? (
                  <button type="button" onClick={() => setSelectedId(v.id)} className="text-left transition-colors hover:text-[#3457d5] focus-visible:outline-2 focus-visible:outline-[#3457d5]">
                    {body}
                  </button>
                ) : (
                  <Link href={`/orders/${v.id}`} className="text-left transition-colors hover:text-[#3457d5]">
                    {body}
                  </Link>
                )}
              </div>
            );
          })}
          <p className="flex items-center justify-between gap-2 pt-[13px] text-[11px] text-muted-foreground">
            <span>
              ნაჩვენებია {visits.length} / {visitsTotal} ვიზიტი
            </span>
            <Link href="/schedule" className="inline-flex items-center gap-1 text-[#3457d5] hover:underline">
              განრიგი <ArrowRight className="size-3" />
            </Link>
          </p>

          <div className="mt-[17px] flex items-center justify-between gap-2 border-t border-border pt-[15px]">
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

          <div className="mt-[18px] border-t border-border pt-[19px]">
            <h3 className="mb-1 flex items-center gap-[7px] font-heading text-[13px] font-medium">
              <Users className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli('გუნდის დატვირთვა')}
            </h3>
            {workload.length === 0 && <p className="py-2 text-muted-foreground">შემსრულებლები არ არიან დამატებული</p>}
            {workload.map((w) => {
              const pct = normHours > 0 ? Math.min(100, Math.round((w.hours / normHours) * 100)) : 0;
              const over = w.hours > normHours;
              const fill = over ? "#c75e50" : pct > 75 ? "#bd9c56" : "#738fca";
              return (
                <div key={w.id}>
                  <div className="mt-[9px] mb-[5px] flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <UserAvatar name={w.name} image={w.image} size="sm" /> {w.name}
                    </span>
                    <span className={cn("tabular text-[11px]", over && "font-medium text-[#c75e50]")}>
                      {w.hours} / {normHours} სთ
                    </span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-sm bg-[#eef1f6]" role="img" aria-label={`${w.name}, დაგეგმილია ${w.hours} საათი ${normHours} საათიდან`}>
                    <i className="block h-full transition-[width] duration-300 ease-out" style={{ width: `${pct}%`, background: fill }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-[13px] text-[11px] text-muted-foreground">დაგეგმილი დრო · დღეს</p>
          </div>
        </aside>
      </div>

      <OrderDrawer order={selected} executors={executors} normHours={normHours} today={today} onClose={() => setSelectedId(null)} />
    </div>
  );
}
