import { and, asc, eq, gte, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { UserAvatar } from "@/components/app/user-avatar";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ACTIVE_STATUSES, t } from "@/lib/i18n";
import { listAssignableUsers } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "განრიგი" };

const DAY_NAMES = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];

function tbilisiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function shift(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function timeLabel(d: Date) {
  return new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const today = tbilisiToday();
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const start = new Date(`${day}T00:00:00+04:00`);
  const end = new Date(`${shift(day, 1)}T00:00:00+04:00`);

  const [dayOrders, unscheduled, users] = await Promise.all([
    db.query.orders.findMany({
      where: and(eq(orders.triaged, true), gte(orders.scheduledAt, start), lt(orders.scheduledAt, end), notInArray(orders.status, ["cancelled"])),
      with: { client: { columns: { id: true, name: true } }, site: { columns: { id: true, name: true, address: true } }, assignees: { with: { user: { columns: { id: true, name: true, image: true } } } } },
      orderBy: [asc(orders.scheduledAt)],
    }),
    db.query.orders.findMany({
      where: and(eq(orders.triaged, true), isNull(orders.scheduledAt), inArray(orders.status, ACTIVE_STATUSES)),
      with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true, image: true } } } } },
      orderBy: [asc(orders.dueDate), asc(orders.createdAt)],
      limit: 50,
    }),
    listAssignableUsers(),
  ]);

  const executors = users.filter((u) => u.role === "executor" || dayOrders.some((o) => o.assignees.some((a) => a.userId === u.id)));
  const columns = executors.map((u) => ({ user: u, items: dayOrders.filter((o) => o.assignees.some((a) => a.userId === u.id)) }));
  const unassigned = dayOrders.filter((o) => o.assignees.length === 0);
  const d = new Date(day + "T00:00:00Z");
  const title = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${DAY_NAMES[d.getUTCDay()]}`;

  const week = Array.from({ length: 7 }, (_, i) => shift(day, i - 3));

  const Item = ({ o }: { o: (typeof dayOrders)[number] }) => (
    <Link href={`/orders/${o.id}`} className="block rounded-lg border bg-white p-2.5 text-sm shadow-sm hover:shadow-md dark:bg-neutral-800">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-blue-700">{o.scheduledAt ? timeLabel(o.scheduledAt) : "—"}</span>
        <StatusBadge status={o.status} className="px-1.5 py-0 text-[10px]" />
      </div>
      <div className="line-clamp-2 font-medium leading-snug">{o.title}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {o.client?.name}
        {o.site ? ` · ${o.site.name}` : ""}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <SystemBadge system={o.systemType} className="px-1.5 py-0 text-[10px]" />
        <PriorityLabel priority={o.priority} />
      </div>
    </Link>
  );

  return (
    <div>
      <PageHeader
        title={t.nav2.schedule}
        subtitle={title}
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/schedule?date=${shift(day, -1)}`} className="rounded-lg border bg-white p-1.5 hover:bg-neutral-50 dark:bg-neutral-900" aria-label="წინა დღე">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/schedule" className={cn("rounded-lg border px-3 py-1.5 text-sm", day === today ? "bg-blue-600 text-white" : "bg-white hover:bg-neutral-50 dark:bg-neutral-900")}>
              დღეს
            </Link>
            <Link href={`/schedule?date=${shift(day, 1)}`} className="rounded-lg border bg-white p-1.5 hover:bg-neutral-50 dark:bg-neutral-900" aria-label="შემდეგი დღე">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto">
        {week.map((w) => {
          const wd = new Date(w + "T00:00:00Z");
          return (
            <Link
              key={w}
              href={`/schedule?date=${w}`}
              className={cn(
                "min-w-[84px] flex-1 rounded-lg border px-2 py-1.5 text-center text-xs",
                w === day ? "border-blue-600 bg-blue-600 text-white" : w === today ? "border-blue-300 bg-white dark:bg-neutral-900" : "bg-white hover:bg-neutral-50 dark:bg-neutral-900",
              )}
            >
              <div className="opacity-80">{DAY_NAMES[wd.getUTCDay()].slice(0, 3)}</div>
              <div className="text-base font-semibold">{wd.getUTCDate()}</div>
            </Link>
          );
        })}
      </div>

      {dayOrders.length === 0 ? (
        <div className="rounded-xl border bg-white py-12 text-center text-sm text-muted-foreground dark:bg-neutral-900">ამ დღეს დაგეგმილი შეკვეთა არ არის</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {unassigned.length > 0 && (
            <div className="w-64 shrink-0 rounded-xl border border-dashed bg-neutral-50 p-2 dark:bg-neutral-900">
              <div className="mb-2 px-1 text-sm font-semibold text-rose-600">დაუნიშნავი · {unassigned.length}</div>
              <div className="space-y-2">
                {unassigned.map((o) => (
                  <Item key={o.id} o={o} />
                ))}
              </div>
            </div>
          )}
          {columns.map(({ user, items }) => (
            <div key={user.id} className="w-64 shrink-0 rounded-xl border bg-neutral-50 p-2 dark:bg-neutral-900">
              <div className="mb-2 flex items-center gap-2 px-1">
                <UserAvatar name={user.name} image={user.image} />
                <span className="truncate text-sm font-semibold">{user.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="min-h-[60px] space-y-2">
                {items.map((o) => (
                  <Item key={o.id} o={o} />
                ))}
                {items.length === 0 && <div className="px-1 text-xs text-muted-foreground">თავისუფალია</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">დაუგეგმავი აქტიური შეკვეთები · {unscheduled.length}</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {unscheduled.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}/edit`} className="flex items-center gap-3 rounded-lg border bg-white p-2.5 text-sm hover:bg-neutral-50 dark:bg-neutral-900">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.client?.name ?? "—"} · ვადა {o.dueDate ?? "—"}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
