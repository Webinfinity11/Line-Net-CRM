import { Layers, MapPinned } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WeeklyBars } from "@/components/app/dashboard-charts";
import { AgingCard, CrewCard, RevenueTrendCard } from "@/components/app/dashboard/analytics";
import { DashboardRings } from "@/components/app/dashboard/rings";
import { DashboardBoard } from "@/components/app/dashboard/board";
import { DashboardHero } from "@/components/app/dashboard/hero";
import { SystemBars } from "@/components/app/dashboard/mini-charts";
import { PeriodPicker } from "@/components/app/dashboard/period-picker";
import { QuickCreate } from "@/components/app/dashboard/quick-create";
import type { BoardOrder, TodayBlock } from "@/components/app/dashboard/types";
import { MapView } from "@/components/app/map-switch";
import { Reveal } from "@/components/app/motion";
import { ViewPrefs } from "@/components/app/view-prefs";
import { dashboardTimeliness, getDashboardAnalytics, recentCash } from "@/lib/analytics";
import { getMailSyncState } from "@/lib/graph-mail";
import { STATUS_HEX, STATUS_LABELS, formatDate, formatMoney, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { isOverdue } from "@/lib/order-utils";
import { getDashboardStats, listAssignableUsers, listClientsWithSites, type DateRange } from "@/lib/orders";
import { tbilisiToday } from "@/lib/schedule-utils";
import { isStaff, requireUser } from "@/lib/session";
import { systemLabels } from "@/lib/systems";
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

/** The blocks anyone can switch off for themselves, in the order they appear. */
const DASHBOARD_BLOCKS = [
  { key: "status-ring", label: "შეკვეთების სტატუსები" },
  { key: "timeliness-ring", label: "დროზე შესრულება" },
  { key: "flow", label: "სამუშაოს ნაკადი", hint: "ბოლო 7 დღე" },
  { key: "systems", label: "კატეგორიები" },
  { key: "aging", label: "გადაუხდელები" },
  { key: "trend", label: "შემოსავლის ტრენდი" },
  { key: "crew", label: "ტექნიკოსები" },
  { key: "map", label: "რუკა" },
];

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect(user.role === "client" ? "/portal" : "/my");
  const sp = await searchParams;
  const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const custom = isDay(sp.from) && isDay(sp.to) && sp.from <= sp.to ? { from: sp.from, to: sp.to } : undefined;
  const rangeDef = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const range = rangeDef.key;
  const periodLabel = custom ? `${formatDate(custom.from)} – ${formatDate(custom.to)}` : rangeDef.period;

  const normHours = await getWorkHoursPerDay();
  const [s, mail, users, clientRows, analytics, cash, timeliness] = await Promise.all([
    getDashboardStats(range, custom),
    getMailSyncState(),
    listAssignableUsers(),
    listClientsWithSites(),
    getDashboardAnalytics(normHours),
    recentCash(14),
    dashboardTimeliness(range, custom),
  ]);

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

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <DashboardHero
        greeting={`გამარჯობა, ${firstName}!`}
        dateLine={dateLine(tbilisiToday())}
        revenue={analytics.trend.thisMonth}
        changePct={analytics.trend.changePct}
        lastMonth={analytics.trend.lastMonth}
        cash={cash}
      >
        <div className="inline-flex max-md:min-w-0 max-md:flex-1 rounded-full border border-[#e6ebf2] bg-white p-1" role="group" aria-label="პერიოდი">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/?range=${r.key}`}
              aria-current={!custom && r.key === range ? "page" : undefined}
              className={cn(
                "rounded-full max-md:flex max-md:min-h-[44px] max-md:flex-1 max-md:items-center max-md:justify-center max-md:px-2 px-3.5 py-1.5 font-heading text-[11.5px] font-bold tracking-[-0.005em] transition-colors duration-150",
                !custom && r.key === range ? "bg-[#3457d5] text-white" : "text-muted-foreground hover:bg-[#f1f4f9] hover:text-foreground",
              )}
            >
              {toMtavruli(r.label)}
            </Link>
          ))}
        </div>
        <PeriodPicker from={custom?.from} to={custom?.to} active={Boolean(custom)} />
        <div className="max-md:hidden"><QuickCreate clients={clients} /></div>
        <ViewPrefs mobileIcon storageKey="ln.dashboard.v1" items={DASHBOARD_BLOCKS} />
      </DashboardHero>

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

      <DashboardRings key={JSON.stringify([range, custom])} counts={s.counts} timeliness={timeliness} period={periodLabel} />

      {/* zone 3: how the work is trending */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,6fr)_minmax(0,3fr)_minmax(0,3fr)]">
        <Reveal as="section" className="ln-card ln-lift min-w-0 p-6 max-md:p-4" ariaLabel="სამუშაოს ნაკადი" view="flow">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-[15px]">{toMtavruli("სამუშაოს ნაკადი")}</h2>
            <span className="text-[11.5px] text-muted-foreground">ბოლო 7 დღე</span>
          </div>
          <WeeklyBars data={s.weekly} height={200} />
        </Reveal>

        <Reveal as="section" className="ln-card ln-lift min-w-0 p-6 max-md:p-4" delay={80} ariaLabel="კატეგორიების მიხედვით" view="systems">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-[15px]">
              <Layers className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("კატეგორიები")}
            </h2>
            <span className="text-[11.5px] text-muted-foreground">{periodLabel}</span>
          </div>
          <SystemBars rows={s.bySystem} labels={await systemLabels()} />
        </Reveal>

        <AgingCard aging={analytics.aging} />
      </div>

      {/* zone 4: where the business is heading */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RevenueTrendCard trend={analytics.trend} />
        <CrewCard crew={analytics.crew} normHours={normHours} />
      </div>

      <Reveal as="section" className="ln-card ln-lift p-6 max-md:p-4" ariaLabel="აქტიური ობიექტები რუკაზე" view="map">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-[15px]">
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
      </Reveal>
    </div>
  );
}
