import { and, asc, eq, gte, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Queue, type QueueItem } from "@/components/app/schedule/queue";
import { Timeline, type TimelineBlock, type TimelineLane } from "@/components/app/schedule/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ACTIVE_STATUSES, formatDate, formatDuration, t } from "@/lib/i18n";
import { listAssignableUsers } from "@/lib/orders";
import { findOverlaps, layoutLane, minutesIntoDay, plannedEnd, tbilisiDayBounds, tbilisiToday, workload, type Slot } from "@/lib/schedule-utils";
import { getWorkHoursPerDay } from "@/lib/settings";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { toMtavruli } from "@/lib/mtavruli";

export const metadata = { title: "განრიგი" };

const DAY_NAMES = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const AXIS_START = 8 * 60;
const AXIS_END = 20 * 60;

function shift(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const today = tbilisiToday();
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { start, end } = tbilisiDayBounds(day);
  const triaged = eq(orders.triaged, true);

  const [dayOrders, unscheduled, users, normHours, awaiting, overdue] = await Promise.all([
    db.query.orders.findMany({
      where: and(triaged, gte(orders.scheduledAt, start), lt(orders.scheduledAt, end), notInArray(orders.status, ["cancelled"])),
      with: { client: { columns: { id: true, name: true } }, site: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true, image: true } } } } },
      orderBy: [asc(orders.scheduledAt)],
    }),
    db.query.orders.findMany({
      where: and(triaged, isNull(orders.scheduledAt), inArray(orders.status, ACTIVE_STATUSES)),
      with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true, image: true } } } } },
      orderBy: [asc(orders.priority), asc(orders.dueDate), asc(orders.createdAt)],
      limit: 50,
    }),
    listAssignableUsers(),
    getWorkHoursPerDay(),
    db.query.orders.findMany({
      where: and(triaged, eq(orders.status, "done")),
      columns: { id: true, number: true, title: true, completedAt: true },
      with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true } } } } },
      orderBy: [asc(orders.completedAt)],
      limit: 8,
    }),
    db.query.orders.findMany({
      where: and(triaged, inArray(orders.status, ACTIVE_STATUSES), lt(orders.dueDate, today)),
      columns: { id: true, number: true, title: true, dueDate: true },
      with: { client: { columns: { id: true, name: true } } },
      orderBy: [asc(orders.dueDate)],
      limit: 8,
    }),
  ]);

  // overlap detection per executor on this day
  const slots: Slot[] = [];
  for (const o of dayOrders) {
    if (!o.scheduledAt) continue;
    for (const a of o.assignees) slots.push({ id: o.id, userId: a.userId, start: o.scheduledAt, end: plannedEnd(o.scheduledAt, o.plannedMinutes) });
  }
  const overlaps = findOverlaps(slots);
  const numberOf = (id: number) => dayOrders.find((x) => x.id === id)?.number ?? String(id);

  // time axis: 08:00–20:00, widened to fit the day's earliest start / latest end
  let axisStartMin = AXIS_START;
  let axisEndMin = AXIS_END;
  for (const o of dayOrders) {
    if (!o.scheduledAt) continue;
    const s = minutesIntoDay(o.scheduledAt, start);
    const e = minutesIntoDay(plannedEnd(o.scheduledAt, o.plannedMinutes), start);
    axisStartMin = Math.min(axisStartMin, Math.floor(s / 60) * 60);
    axisEndMin = Math.max(axisEndMin, Math.ceil(e / 60) * 60);
  }
  axisStartMin = Math.max(0, axisStartMin);
  axisEndMin = Math.min(24 * 60, axisEndMin);

  const toBlocks = (items: typeof dayOrders): TimelineBlock[] => {
    const laneSlots = items.filter((o) => o.scheduledAt).map((o) => ({ id: o.id, start: o.scheduledAt as Date, end: plannedEnd(o.scheduledAt as Date, o.plannedMinutes) }));
    const placement = new Map(layoutLane(laneSlots).map((p) => [p.id, p]));
    return items
      .filter((o) => o.scheduledAt)
      .map((o) => {
        const p = placement.get(o.id) ?? { col: 0, cols: 1 };
        return {
          id: o.id,
          number: o.number,
          title: o.title,
          client: o.client?.name ?? o.site?.name ?? null,
          status: o.status,
          startMin: minutesIntoDay(o.scheduledAt as Date, start),
          endMin: minutesIntoDay(plannedEnd(o.scheduledAt as Date, o.plannedMinutes), start),
          col: p.col,
          cols: p.cols,
          clashWith: (overlaps.get(o.id) ?? []).map(numberOf),
        };
      });
  };

  const executors = users.filter((u) => u.role === "executor" || dayOrders.some((o) => o.assignees.some((a) => a.userId === u.id)));
  const unassignedToday = dayOrders.filter((o) => o.assignees.length === 0);
  const lanes: TimelineLane[] = [];
  if (unassignedToday.length > 0) {
    lanes.push({ key: "unassigned", name: `დაუნიშნავი · ${unassignedToday.length}`, unassigned: true, blocks: toBlocks(unassignedToday) });
  }
  for (const u of executors) {
    const items = dayOrders.filter((o) => o.assignees.some((a) => a.userId === u.id));
    const minutes = items.reduce((sum, o) => sum + (o.plannedMinutes ?? 120), 0);
    lanes.push({ key: u.id, name: u.name, image: u.image, load: workload(minutes, normHours), blocks: toBlocks(items) });
  }

  const nowMin = day === today ? minutesIntoDay(new Date(), start) : null;
  const overlapCount = overlaps.size;
  const executorOptions = users
    .filter((u) => u.role === "executor")
    .map((u) => ({ id: u.id, name: u.name, image: u.image, specializations: u.specializations ?? [], hours: lanes.find((l) => l.key === u.id)?.load?.hours ?? 0 }));
  const queue: QueueItem[] = [
    ...unassignedToday.map((o) => ({ id: o.id, number: o.number, title: o.title, client: o.client?.name ?? null, dueDate: o.dueDate, priority: o.priority, systemType: o.systemType, scheduled: true, currentAssigneeId: null })),
    ...unscheduled.map((o) => ({ id: o.id, number: o.number, title: o.title, client: o.client?.name ?? null, dueDate: o.dueDate, priority: o.priority, systemType: o.systemType, scheduled: false, currentAssigneeId: o.assignees[0]?.userId ?? null })),
  ];

  const d = new Date(day + "T00:00:00Z");
  const title = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${DAY_NAMES[d.getUTCDay()]}`;
  const week = Array.from({ length: 7 }, (_, i) => shift(day, i - 3));

  return (
    <div>
      <PageHeader
        kicker={t.nav2.schedule}
        title={title}
        subtitle={`ნორმა ${normHours} სთ/დღე · ${dayOrders.length} დაგეგმილი ვიზიტი`}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" className="h-10 w-10 md:h-8 md:w-8" render={<Link href={`/schedule?date=${shift(day, -1)}`} aria-label="წინა დღე" />}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant={day === today ? "default" : "outline"} size="sm" className="h-10 md:h-8" render={<Link href="/schedule" />}>
              დღეს
            </Button>
            <Button variant="outline" size="icon-sm" className="h-10 w-10 md:h-8 md:w-8" render={<Link href={`/schedule?date=${shift(day, 1)}`} aria-label="შემდეგი დღე" />}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-7 gap-1 sm:flex sm:gap-1.5">
        {week.map((w) => {
          const wd = new Date(w + "T00:00:00Z");
          return (
            <Link
              key={w}
              href={`/schedule?date=${w}`}
              aria-current={w === day ? "date" : undefined}
              className={cn(
                "rounded-md border px-1 py-1.5 text-center text-[11px] transition-colors duration-150 sm:min-w-[72px] sm:flex-1 sm:px-2",
                w === day
                  ? "border-[#3457d5] bg-[#3457d5] text-white"
                  : w === today
                    ? "border-[#a5b5ed] bg-white text-foreground hover:bg-[#f8faff]"
                    : "border-[#e6ebf2] bg-white text-muted-foreground hover:bg-[#f8faff] hover:text-foreground",
              )}
            >
              <div>{DAY_NAMES[wd.getUTCDay()].slice(0, 3)}</div>
              <div className="text-[15px] font-medium leading-tight tabular">{wd.getUTCDate()}</div>
            </Link>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#e6ebf2] bg-white px-4 py-2.5 text-xs" role="status">
        <span className={cn(unassignedToday.length ? "font-medium text-[#a73b2d]" : "text-muted-foreground")}>დაუნიშნავი დღეს {unassignedToday.length}</span>
        <span className="text-[#c9d3e3]">·</span>
        <span className="text-muted-foreground">დაუგეგმავი აქტიური {unscheduled.length}</span>
        <span className="text-[#c9d3e3]">·</span>
        <span className={cn(overlapCount ? "font-medium text-[#a73b2d]" : "text-muted-foreground")}>გადაფარვა {overlapCount}</span>
      </div>

      <div className="ln-stagger grid gap-[18px] lg:grid-cols-[minmax(260px,3fr)_minmax(0,7fr)]">
        <Card className="self-start">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>დაუნიშნავი / დაუგეგმავი</CardTitle>
            <span className="text-[11px] text-muted-foreground tabular">{queue.length}</span>
          </CardHeader>
          <CardContent>
            <Queue items={queue} day={day} executors={executorOptions} normHours={normHours} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ტექნიკოსების განრიგი</CardTitle>
            <span className="text-[11px] text-muted-foreground">დაგეგმილი დრო · ერთი ღერძი</span>
          </CardHeader>
          <CardContent>
            <Timeline lanes={lanes} axisStartMin={axisStartMin} axisEndMin={axisEndMin} normHours={normHours} nowMin={nowMin} />
          </CardContent>
        </Card>
      </div>

      <div className="ln-stagger mt-[18px] grid gap-[18px] md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ჩასაბარებელი</CardTitle>
            <span className="text-[11px] text-muted-foreground">შესრულებული, ელოდება შემოწმებას</span>
          </CardHeader>
          <CardContent>
            {awaiting.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">ჩასაბარებელი შეკვეთა არ არის</p>}
            {awaiting.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[#e6ebf2] py-2.5 text-xs first:border-t-0 hover:text-[#3457d5]">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">{o.title}</span>
                  <span className="block truncate text-muted-foreground">
                    {o.number} · {o.client?.name ?? "—"}
                    {o.assignees.length ? ` · ${o.assignees.map((a) => a.user.name.split(" ")[0]).join(", ")}` : ""}
                  </span>
                </span>
                <span className="text-muted-foreground tabular">{o.completedAt ? formatDate(o.completedAt, true) : "—"}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ვადაგადაცილებული</CardTitle>
            <span className="text-[11px] text-muted-foreground">აქტიური, ვადა გასულია</span>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">ვადაგადაცილებული შეკვეთა არ არის</p>}
            {overdue.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[#e6ebf2] py-2.5 text-xs first:border-t-0 hover:text-[#3457d5]">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">{o.title}</span>
                  <span className="block truncate text-muted-foreground">
                    {o.number} · {o.client?.name ?? "—"}
                  </span>
                </span>
                <span className="font-medium text-[#a73b2d] tabular">{formatDate(o.dueDate)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        ხანგრძლივობა: {formatDuration(120)} ნაგულისხმევად, თუ შეკვეთაზე არ არის მითითებული. დღის ნორმა იცვლება ადმინის პარამეტრებში.
      </p>
    </div>
  );
}
