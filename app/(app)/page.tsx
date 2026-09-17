import { Layers, MapPinned, Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyBars } from "@/components/app/dashboard-charts";
import { DashboardBoard } from "@/components/app/dashboard/board";
import { SystemBars } from "@/components/app/dashboard/mini-charts";
import { QuickCreate } from "@/components/app/dashboard/quick-create";
import type { BoardOrder, TodayBlock } from "@/components/app/dashboard/types";
import { MapView } from "@/components/app/map-view";
import { getMailSyncState } from "@/lib/graph-mail";
import { STATUS_HEX, STATUS_LABELS, formatDate, formatMoney, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { isOverdue } from "@/lib/order-utils";
import { getDashboardStats, listAssignableUsers, listClientsWithSites, type DateRange } from "@/lib/orders";
import { tbilisiToday } from "@/lib/schedule-utils";
import { isStaff, requireUser } from "@/lib/session";
import { getWorkHoursPerDay } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "დაფა" };

const RANGES: { key: DateRange; label: string; period: string }[] = [
  { key: "today", label: t.common.today, period: "დღეს" },
  { key: "week", label: t.common.week, period: "ამ კვირაში" },
  { key: "month", label: t.common.month, period: "ამ თვეში" },
];

const DAY_NAMES = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];

const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const timeOf = (d: Date) => hmFmt.format(d);
/** Minutes from midnight in Tbilisi, for placing a visit on the day strip. */
function minutesOf(d: Date) {
  const [h, m] = hmFmt.format(d).split(":").map(Number);
  return h * 60 + m;
}

function dateLine(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const ACTIVE = new Set(["new", "assigned", "in_progress"]);

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/my");
  const sp = await searchParams;
  const rangeDef = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const range = rangeDef.key;

  const [s, mail, users, clientRows, normHours] = await Promise.all([getDashboardStats(range), getMailSyncState(), listAssignableUsers(), listClientsWithSites(), getWorkHoursPerDay()]);

  const executors = users
    .filter((u) => u.role === "executor")
    .map((u) => ({ id: u.id, name: u.name, image: u.image, specializations: u.specializations ?? [], hours: Math.round(((s.plannedToday[u.id] ?? 0) / 60) * 10) / 10 }));
  const clients = clientRows.map((c) => ({ id: c.id, name: c.name }));

  const rank = (o: { priority: string; status: string; assignees: unknown[]; overdue: boolean }) =>
    o.priority === "urgent" && o.assignees.length === 0 && ACTIVE.has(o.status) ? 0 : o.overdue ? 1 : 2;
  const board: BoardOrder[] = s.board
    .map((o) => ({
      id: o.id,
      number: o.number,
      title: o.title,
      status: o.status,
      priority: o.priority,
      type: o.type,
      systemType: o.systemType,
      dueDate: o.dueDate,
      scheduledAt: o.scheduledAt ? o.scheduledAt.toISOString() : null,
      timeLabel: o.scheduledAt ? timeOf(o.scheduledAt) : null,
      scheduledLabel: o.scheduledAt ? formatDate(o.scheduledAt, true) : null,
      plannedMinutes: o.plannedMinutes,
      description: o.description,
      client: o.client,
      site: o.site,
      assignees: o.assignees.map((a) => ({ id: a.user.id, name: a.user.name, image: a.user.image })),
      overdue: isOverdue(o),
    }))
    .sort((a, b) => rank(a) - rank(b));

  const workload = executors.map((u) => ({ id: u.id, name: u.name, image: u.image, hours: u.hours }));
  const lanes = executors.filter((u) => u.hours > 0 || s.today.some((o) => o.assignees.some((a) => a.userId === u.id))).map((u) => ({ id: u.id, name: u.name, image: u.image }));

  const blocks: TodayBlock[] = s.today.flatMap((o) => {
    if (!o.scheduledAt) return [];
    const base = {
      id: o.id,
      title: o.title,
      client: o.client?.name ?? null,
      timeLabel: timeOf(o.scheduledAt),
      startMin: minutesOf(o.scheduledAt),
      minutes: o.plannedMinutes ?? 120,
      status: o.status,
    };
    if (o.assignees.length === 0) return [{ ...base, laneId: "unassigned" }];
    return o.assignees.map((a) => ({ ...base, laneId: a.userId }));
  });
  const completedToday = s.today.filter((o) => o.status === "done" || o.status === "closed").length;

  const collected = s.money.paid + s.money.unpaid;
  const paidPct = collected > 0 ? Math.round((s.money.paid / collected) * 100) : 0;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <header className="ln-enter flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[26px] font-semibold leading-[1.3] tracking-[-0.5px]">{toMtavruli(`გამარჯობა, ${firstName}!`)}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{dateLine(tbilisiToday())}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[#e6ebf2] bg-white p-1" role="group" aria-label="პერიოდი">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/?range=${r.key}`}
                aria-current={r.key === range ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-heading text-[11.5px] font-bold tracking-[-0.005em] transition-colors duration-150",
                  r.key === range ? "bg-[#3457d5] text-white" : "text-muted-foreground hover:bg-[#f1f4f9] hover:text-foreground",
                )}
              >
                {toMtavruli(r.label)}
              </Link>
            ))}
          </div>
          <QuickCreate clients={clients} />
        </div>
      </header>

      {/* zones 1 and 2: what needs a decision, and how today is laid out */}
      <DashboardBoard
        orders={board}
        blocks={blocks}
        lanes={lanes}
        executors={executors}
        workload={workload}
        normHours={normHours}
        today={tbilisiToday()}
        mail={{ configured: mail.configured, count: s.inbox.length, connectHref: "/inbox" }}
        counts={{ unassigned: s.unassignedCount, overdue: s.overdueCount, review: s.awaitingClosureCount, visits: s.todayTotal, completedToday }}
      />

      {/* zone 3: how the work is trending */}
      <div className="ln-enter ln-enter-3 grid gap-4 xl:grid-cols-[minmax(0,6fr)_minmax(0,3fr)_minmax(0,3fr)]">
        <section className="ln-card min-w-0 p-6" aria-label="სამუშაოს ნაკადი">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[15px] font-semibold">{toMtavruli("სამუშაოს ნაკადი")}</h2>
            <span className="text-[11.5px] text-muted-foreground">ბოლო 7 დღე</span>
          </div>
          <WeeklyBars data={s.weekly} height={200} />
        </section>

        <section className="ln-card min-w-0 p-6" aria-label="სისტემების მიხედვით">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold">
              <Layers className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("სისტემები")}
            </h2>
            <span className="text-[11.5px] text-muted-foreground">{rangeDef.period}</span>
          </div>
          <SystemBars rows={s.bySystem} />
        </section>

        <section className="ln-card min-w-0 p-6" aria-label="თანხები">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold">
              <Wallet className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("თანხები")}
            </h2>
            <span className="text-[11.5px] text-muted-foreground">{rangeDef.period}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">მიღებული</div>
          <div className="tabular mt-1 font-heading text-[30px] font-semibold leading-none tracking-[-0.8px] text-[#25815a]">{formatMoney(s.money.paid)}</div>
          <div className="mt-5 text-[11px] text-muted-foreground">გადაუხდელი ნაშთი · ყველა შეკვეთა</div>
          <div className="tabular mt-1 font-heading text-[20px] font-semibold text-[#a84630]">{formatMoney(s.money.unpaid)}</div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-muted-foreground">გადახდის მაჩვენებელი</span>
              <span className="tabular font-semibold">{paidPct}%</span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-[#f1f4f9]">
              <div className="ln-bar h-full rounded-full bg-[#25815a]" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        </section>
      </div>

      <section className="ln-card ln-enter ln-enter-4 p-6" aria-label="აქტიური ობიექტები რუკაზე">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold">
            <MapPinned className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("აქტიური ობიექტები")}
            <span className="text-[11.5px] font-normal text-muted-foreground">{s.mapPoints.length}</span>
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(["new", "assigned", "in_progress"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: STATUS_HEX[k] }} /> {STATUS_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
        {s.mapPoints.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#e6ebf2] px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            ობიექტებს კოორდინატები არ აქვს. გახსენით კლიენტი → ობიექტი → „რუკაზე მონიშვნა“.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <MapView
              height={340}
              showLabels={false}
              markers={s.mapPoints.map((p, i) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                code: String(i + 1),
                color: STATUS_HEX[p.status],
                label: p.siteName ?? p.clientName ?? p.number,
                detail: `${p.number} · ${p.title}`,
                href: `/orders/${p.id}`,
              }))}
            />
            <ol className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
              {s.mapPoints.map((p, i) => (
                <li key={p.id}>
                  <Link href={`/orders/${p.id}`} className="flex items-start gap-2.5 rounded-[12px] px-2 py-2 transition-colors hover:bg-[#f8faff]">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: STATUS_HEX[p.status] }}>
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px]">{p.siteName ?? p.clientName ?? p.number}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{p.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
