import { MapPinned } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardBoard } from "@/components/app/dashboard/board";
import { QuickCreate } from "@/components/app/dashboard/quick-create";
import type { BoardOrder } from "@/components/app/dashboard/types";
import { MapView } from "@/components/app/map-view";
import { PageHeader } from "@/components/app/page-header";
import { getMailSyncState } from "@/lib/graph-mail";
import { STATUS_HEX, STATUS_LABELS, formatDate, formatMoney, t } from "@/lib/i18n";
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

  const executors = users.filter((u) => u.role === "executor").map((u) => ({ id: u.id, name: u.name, image: u.image }));
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

  const workload = executors.map((u) => ({ ...u, hours: Math.round(((s.plannedToday[u.id] ?? 0) / 60) * 10) / 10 }));

  return (
    <div className="space-y-5">
      <PageHeader
        kicker={kickerFor(tbilisiToday())}
        title="სამუშაო დაფა"
        subtitle="დღევანდელი პრიორიტეტები და გუნდის საქმეები"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5" role="group" aria-label="პერიოდი">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/?range=${r.key}`}
                  aria-current={r.key === range ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-heading text-[11.5px] font-medium uppercase tracking-wide transition-colors duration-150",
                    r.key === range ? "bg-[#eef2ff] text-[#3457d5]" : "text-muted-foreground hover:bg-[#f8faff] hover:text-foreground",
                  )}
                >
                  {r.label}
                </Link>
              ))}
            </div>
            <QuickCreate clients={clients} />
          </div>
        }
      />

      <DashboardBoard
        metrics={{ active: s.activeTotal, visits: s.todayTotal, overdue: s.overdueCount, review: s.awaitingClosureCount }}
        orders={board}
        visits={visits}
        visitsTotal={s.todayTotal}
        executors={executors}
        workload={workload}
        normHours={normHours}
        mail={{ configured: mail.configured, count: s.inbox.length, connectHref: "/inbox" }}
        warrantyCount={s.warranty.length}
      />

      {/* finance: secondary, precise labels, no derived percentage */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2" aria-label="თანხები">
        <div className="bg-white px-[18px] py-[14px]">
          <div className="text-[11px] text-muted-foreground">მიღებული · {rangeDef.period}</div>
          <div className="tabular mt-1 font-heading text-[19px] font-medium text-foreground">{formatMoney(s.money.paid)}</div>
        </div>
        <div className="bg-white px-[18px] py-[14px]">
          <div className="text-[11px] text-muted-foreground">გადაუხდელი ნაშთი · ყველა შეკვეთა</div>
          <div className="tabular mt-1 font-heading text-[19px] font-medium text-foreground">{formatMoney(s.money.unpaid)}</div>
        </div>
      </section>

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
    </div>
  );
}
