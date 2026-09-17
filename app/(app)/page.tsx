import { CircleCheck, MapPinned, UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusDonut, WeeklyBars } from "@/components/app/dashboard-charts";
import { DashboardBoard } from "@/components/app/dashboard/board";
import { QuickCreate } from "@/components/app/dashboard/quick-create";
import { AwaitingCard, StatCard, type Trend } from "@/components/app/dashboard/stat-card";
import type { BoardOrder } from "@/components/app/dashboard/types";
import { MapView } from "@/components/app/map-view";
import { getMailSyncState } from "@/lib/graph-mail";
import { STATUS_HEX, STATUS_LABELS, STATUS_ORDER, formatDate, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { isOverdue } from "@/lib/order-utils";
import { getDashboardStats, listAssignableUsers, listClientsWithSites, type DateRange } from "@/lib/orders";
import { tbilisiToday } from "@/lib/schedule-utils";
import { isStaff, requireUser } from "@/lib/session";
import { getWorkHoursPerDay } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "დაფა" };

const RANGES: { key: DateRange; label: string; period: string; prev: string }[] = [
  { key: "today", label: t.common.today, period: "დღეს", prev: "გუშინდელთან" },
  { key: "week", label: t.common.week, period: "ამ კვირაში", prev: "წინა კვირასთან" },
  { key: "month", label: t.common.month, period: "ამ თვეში", prev: "წინა თვესთან" },
];

const DAY_NAMES = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const timeOf = (d: Date) => timeFmt.format(d);

function dateLine(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Only shown when a real previous-period figure exists. */
function trendOf(cur: number, prev: number, label: string): Trend {
  if (prev <= 0) return null;
  return { pct: Math.round(((cur - prev) / prev) * 100), label };
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

  const visits = s.today.slice(0, 5).map((o) => ({
    id: o.id,
    time: o.scheduledAt ? timeOf(o.scheduledAt) : "—",
    client: o.client?.name ?? o.title,
    executor: o.assignees.map((a) => a.user.name.split(" ")[0]).join(", ") || "დაუნიშნავი",
    site: o.title,
  }));

  const workload = executors.map((u) => ({ id: u.id, name: u.name, image: u.image, hours: u.hours }));
  const donut = STATUS_ORDER.map((k) => ({ name: STATUS_LABELS[k], value: s.counts[k] ?? 0, color: STATUS_HEX[k] }));
  const donutTotal = donut.reduce((a, b) => a + b.value, 0);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[28px] font-medium leading-[1.3] tracking-[-0.6px]">{toMtavruli(`გამარჯობა, ${firstName}!`)}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">ასეთია სერვისის სურათი {rangeDef.period}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-[12.5px] text-muted-foreground md:inline">{dateLine(tbilisiToday())}</span>
          <div className="inline-flex rounded-full border border-border bg-white p-1" role="group" aria-label="პერიოდი">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/?range=${r.key}`}
                aria-current={r.key === range ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11.5px] transition-colors duration-150",
                  r.key === range ? "bg-[#3457d5] font-medium text-white" : "text-muted-foreground hover:bg-[#f3f6fb] hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <QuickCreate clients={clients} />
        </div>
      </header>

      <div className="ln-stagger grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="აქტიური შეკვეთები" value={s.activeTotal} caption="მიმდინარე ჯამი" href="/orders?status=active" filled />
          <StatCard label="დღევანდელი ვიზიტები" value={s.todayTotal} caption="დაგეგმილია დღეს" href="/schedule" />
          <StatCard label="ვადაგადაცილებული" value={s.overdueCount} caption="მიმდინარე ჯამი" href="/orders?overdue=1" />
          <StatCard
            label="შესრულებული"
            value={s.completed}
            caption={`${rangeDef.period} · ${rangeDef.prev}`}
            href="/orders?status=done"
            trend={trendOf(s.completed, s.previous.completed, rangeDef.prev)}
          />
        </div>

        <section className="ln-card p-[22px]" aria-label="კვირის დინამიკა">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-[16px] font-semibold">{toMtavruli("კვირის დინამიკა")}</h3>
            <span className="text-[11.5px] text-muted-foreground">ბოლო 7 დღე · შექმნილი და შესრულებული</span>
          </div>
          <WeeklyBars data={s.weekly} height={236} />
        </section>
      </div>

      <div className="ln-stagger grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
        <AwaitingCard
          value={s.unassignedCount}
          unit="შეკვეთა"
          sentence={["ელოდება", "და დროის განსაზღვრას."]}
          highlight="შემსრულებლის დანიშვნას"
          href="/orders?status=active"
          icon={UserPlus}
          tone={{ bg: "#edf2ff", fg: "#3457d5" }}
        />
        <AwaitingCard
          value={s.awaitingClosureCount}
          unit="შეკვეთა"
          sentence={["შესრულებულია და", "დახურვამდე."]}
          highlight="ელოდება შემოწმებას"
          href="/orders?status=done"
          icon={CircleCheck}
          tone={{ bg: "#eaf6ef", fg: "#25815a" }}
        />
        <section className="ln-card p-[22px]" aria-label="შეკვეთები სტატუსებით">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-[16px] font-semibold">{toMtavruli("შეკვეთები სტატუსებით")}</h3>
            <span className="text-[11.5px] text-muted-foreground">{rangeDef.period}</span>
          </div>
          {donutTotal === 0 ? <p className="py-10 text-center text-[12.5px] text-muted-foreground">ამ პერიოდში შეკვეთა არ არის</p> : <StatusDonut data={donut} total={donutTotal} />}
        </section>
      </div>

      <DashboardBoard
        orders={board}
        visits={visits}
        visitsTotal={s.todayTotal}
        executors={executors}
        workload={workload}
        normHours={normHours}
        today={tbilisiToday()}
        mail={{ configured: mail.configured, count: s.inbox.length, connectHref: "/inbox" }}
        money={{ paid: s.money.paid, unpaid: s.money.unpaid, periodLabel: rangeDef.period }}
      />

      <section className="ln-card p-[22px]" aria-label="აქტიური ობიექტები რუკაზე">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-heading text-[16px] font-semibold">
            <MapPinned className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("აქტიური ობიექტები რუკაზე")}
            <span className="text-[11.5px] font-normal text-muted-foreground">{s.mapPoints.length} ობიექტი</span>
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(["new", "assigned", "in_progress"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: STATUS_HEX[k] }} /> {STATUS_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
        {s.mapPoints.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            ობიექტებს კოორდინატები არ აქვს. გახსენით კლიენტი → ობიექტი → „რუკაზე მონიშვნა“.
          </p>
        ) : (
          <MapView
            height={300}
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
        )}
      </section>
    </div>
  );
}
