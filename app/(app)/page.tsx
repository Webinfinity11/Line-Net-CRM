import { AlertTriangle, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusDonut, WeeklyBars } from "@/components/app/dashboard-charts";
import { DashboardBoard } from "@/components/app/dashboard/board";
import { QuickCreate } from "@/components/app/dashboard/quick-create";
import type { BoardOrder } from "@/components/app/dashboard/types";
import { MapView } from "@/components/app/map-view";
import { PageHeader } from "@/components/app/page-header";
import { getMailSyncState } from "@/lib/graph-mail";
import { STATUS_HEX, STATUS_LABELS, STATUS_ORDER, formatDate, formatMoney, t } from "@/lib/i18n";
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

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const timeOf = (d: Date) => timeFmt.format(d);

function kickerFor(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
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

  // board rows: urgent unassigned work first, then overdue, then the server order (recently updated)
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
  const collected = s.money.paid + s.money.unpaid;
  const paidPct = collected > 0 ? Math.round((s.money.paid / collected) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        kicker={kickerFor(tbilisiToday())}
        title="სამუშაო დაფა"
        subtitle="დღევანდელი პრიორიტეტები და გუნდის საქმეები"
        actions={<QuickCreate clients={clients} />}
      />

      <DashboardBoard
        metrics={{ active: s.activeTotal, visits: s.todayTotal, overdue: s.overdueCount, review: s.awaitingClosureCount }}
        orders={board}
        visits={visits}
        visitsTotal={s.todayTotal}
        executors={executors}
        workload={workload}
        normHours={normHours}
        today={tbilisiToday()}
        mail={{ configured: mail.configured, count: s.inbox.length, connectHref: "/inbox" }}
        warrantyCount={s.warranty.length}
      />

      {/* analytics: status split, weekly dynamics, money */}
      <div className="ln-stagger grid gap-[18px] lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-white p-[18px]" aria-label="შეკვეთები სტატუსებით">
          <h3 className="mb-3 font-heading text-[13px] font-medium">
            შეკვეთები სტატუსებით <span className="text-[11px] font-normal text-[#748197]">{rangeDef.period}</span>
          </h3>
          {donutTotal === 0 ? <p className="py-6 text-center text-[12px] text-muted-foreground">ამ პერიოდში შეკვეთა არ არის</p> : <StatusDonut data={donut} total={donutTotal} />}
        </section>
        <section className="rounded-xl border border-border bg-white p-[18px]" aria-label="კვირის დინამიკა">
          <h3 className="mb-3 font-heading text-[13px] font-medium">
            კვირის დინამიკა <span className="text-[11px] font-normal text-[#748197]">ბოლო 7 დღე</span>
          </h3>
          <WeeklyBars data={s.weekly} />
        </section>
        <section className="rounded-xl border border-border bg-white p-[18px]" aria-label="თანხები">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-heading text-[13px] font-medium">თანხები</h3>
            <div className="inline-flex rounded-md border border-border bg-white p-0.5" role="group" aria-label="პერიოდი">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/?range=${r.key}`}
                  aria-current={r.key === range ? "page" : undefined}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors duration-150",
                    r.key === range ? "bg-[#eef2ff] font-medium text-[#3457d5]" : "text-muted-foreground hover:bg-[#f8faff] hover:text-foreground",
                  )}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-[#f8faff] p-3">
              <div className="text-[11px] text-muted-foreground">მიღებული · {rangeDef.period}</div>
              <div className="tabular mt-1 font-heading text-[19px] font-medium">{formatMoney(s.money.paid)}</div>
            </div>
            <div className="rounded-lg border border-border bg-[#fff8f6] p-3">
              <div className="text-[11px] text-muted-foreground">გადაუხდელი · ყველა შეკვეთა</div>
              <div className="tabular mt-1 font-heading text-[19px] font-medium text-[#a84630]">{formatMoney(s.money.unpaid)}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="text-muted-foreground">გადახდის მაჩვენებელი</span>
              <span className="tabular font-medium">{paidPct}%</span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-sm bg-[#eef1f6]">
              <div className="h-full rounded-sm bg-[#25815a] transition-[width] duration-300" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {formatMoney(s.money.paid)} მიღებულია / {formatMoney(collected)} სულ
            </div>
          </div>
        </section>
      </div>

      {/* map: secondary, kept compact */}
      <section className="rounded-xl border border-border bg-white p-[18px]" aria-label="აქტიური ობიექტები რუკაზე">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-[7px] font-heading text-[13px] font-medium">
            <MapPinned className="size-4 text-muted-foreground [stroke-width:1.7]" /> აქტიური ობიექტები რუკაზე
            <span className="text-[11px] font-normal text-[#748197]">{s.mapPoints.length} ობიექტი</span>
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
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
            ობიექტებს კოორდინატები არ აქვს. გახსენით კლიენტი → ობიექტი → „რუკაზე მონიშვნა“.
          </p>
        ) : (
          <MapView
            height={260}
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
      {(s.overdue.length > 0 || s.warranty.length > 0) && (
        <div className="ln-stagger grid gap-[18px] lg:grid-cols-2">
          {s.overdue.length > 0 && (
            <section className="rounded-xl border border-[#f4e2d7] bg-white p-[18px]" aria-label="ვადაგადაცილებული შეკვეთები">
              <h3 className="mb-2 flex items-center gap-2 font-heading text-[13px] font-medium text-[#a84630]">
                <AlertTriangle className="size-4 [stroke-width:1.7]" /> ვადაგადაცილებული შეკვეთები
                <span className="text-[11px] font-normal text-[#748197]">{s.overdueCount}</span>
              </h3>
              <ul className="divide-y divide-border text-[12px]">
                {s.overdue.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2">
                    <Link href={`/orders/${o.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-[#3457d5]">
                      {o.title}
                    </Link>
                    <span className="hidden truncate text-muted-foreground sm:inline">{o.client?.name ?? o.number}</span>
                    <span className="tabular shrink-0 font-medium text-[#b13f32]">{formatDate(o.dueDate)}</span>
                  </li>
                ))}
              </ul>
              {s.overdueCount > 6 && (
                <Link href="/orders?overdue=1" className="mt-2 inline-block text-[11px] text-[#3457d5] hover:underline">
                  ყველას ნახვა →
                </Link>
              )}
            </section>
          )}
          {s.warranty.length > 0 && (
            <section className="rounded-xl border border-border bg-white p-[18px]" aria-label="გარანტია იწურება">
              <h3 className="mb-2 flex items-center gap-2 font-heading text-[13px] font-medium">
                <ShieldCheck className="size-4 text-[#25815a] [stroke-width:1.7]" /> გარანტია იწურება
                <span className="text-[11px] font-normal text-[#748197]">30 დღეში</span>
              </h3>
              <ul className="divide-y divide-border text-[12px]">
                {s.warranty.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2">
                    <Link href={`/orders/${o.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-[#3457d5]">
                      {o.title}
                    </Link>
                    <span className="hidden truncate text-muted-foreground sm:inline">{o.client?.name ?? o.number}</span>
                    <span className="tabular shrink-0 font-medium text-[#96610b]">{formatDate(o.warrantyUntil)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
