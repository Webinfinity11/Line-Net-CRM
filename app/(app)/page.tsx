import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Clock3, Inbox, Mail, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderTable } from "@/components/app/order-table";
import { PageHeader } from "@/components/app/page-header";
import { StatusDonut, WeeklyBars } from "@/components/app/dashboard-charts";
import { UserAvatar } from "@/components/app/user-avatar";
import { MapView } from "@/components/app/map-view";
import { PriorityLabel, StatusBadge } from "@/components/app/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_HEX, STATUS_LABELS, STATUS_ORDER, formatDate, formatMoney, t } from "@/lib/i18n";
import { getDashboardStats, type DateRange } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "დაფა" };

const RANGES: { key: DateRange; label: string }[] = [
  { key: "today", label: t.common.today },
  { key: "week", label: t.common.week },
  { key: "month", label: t.common.month },
];

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/my");
  const sp = await searchParams;
  const range = (RANGES.some((r) => r.key === sp.range) ? sp.range : "week") as DateRange;
  const s = await getDashboardStats(range);

  const stat = [
    { label: "ახალი", value: s.counts.new ?? 0, icon: ClipboardList, tone: "bg-sky-100 text-sky-700", href: "/orders?status=new" },
    { label: "მიმდინარე", value: (s.counts.assigned ?? 0) + (s.counts.in_progress ?? 0), icon: Clock3, tone: "bg-amber-100 text-amber-700", href: "/orders?status=active" },
    { label: "შესრულებული", value: s.completed, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700", href: "/orders?status=done" },
    { label: "ვადაგადაცილებული", value: s.overdue.length, icon: AlertTriangle, tone: "bg-rose-100 text-rose-700", href: "/orders?overdue=1" },
  ];

  const donut = STATUS_ORDER.map((k) => ({ name: STATUS_LABELS[k], value: s.counts[k] ?? 0, color: STATUS_HEX[k] }));
  const total = donut.reduce((a, b) => a + b.value, 0);
  const paidPct = s.money.paid + s.money.unpaid > 0 ? Math.round((s.money.paid / (s.money.paid + s.money.unpaid)) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="დაფა"
        subtitle={formatDate(new Date())}
        actions={
          <div className="flex rounded-lg border bg-white p-0.5 dark:bg-neutral-900">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/?range=${r.key}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  r.key === range ? "bg-sky-600 text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stat.map((x) => (
          <Link key={x.label} href={x.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", x.tone)}>
                  <x.icon className="size-5" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{x.label}</div>
                  <div className="text-2xl font-semibold leading-tight">{x.value}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">შეკვეთები სტატუსებით</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ამ პერიოდში შეკვეთები არ არის</p>
            ) : (
              <StatusDonut data={donut} total={total} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ბოლო 7 დღე</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyBars data={s.weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">დღევანდელი ვადები</CardTitle>
            <Link href="/orders?status=active" className="text-xs text-sky-600 hover:underline">
              ყველა →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.today.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">დღეს ვადა არცერთ შეკვეთას არ აქვს</p>}
            {s.today.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{o.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.client?.name ?? "—"} · {o.assignees.map((a) => a.user.name).join(", ") || "დაუნიშნავი"}
                  </div>
                </div>
                <PriorityLabel priority={o.priority} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">ბოლო შეკვეთები</CardTitle>
            <Link href="/orders" className="flex items-center gap-1 text-xs text-sky-600 hover:underline">
              ყველა <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={s.recent} compact />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4 text-sky-600" /> შემოსული წერილები
              </CardTitle>
              <Link href="/inbox" className="text-xs text-sky-600 hover:underline">
                ყველა →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.inbox.length === 0 && (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Inbox className="size-4" /> დაუმუშავებელი წერილები არ არის
                </p>
              )}
              {s.inbox.map((o) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="block rounded-lg border p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <div className="truncate text-sm font-medium">{o.emailSubject ?? o.title}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{o.emailFrom}</span>
                    <span>{formatDate(o.emailReceivedAt ?? o.createdAt, true)}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">თანხები</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">შემოსული ({RANGES.find((r) => r.key === range)?.label})</div>
                  <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">{formatMoney(s.money.paid)}</div>
                </div>
                <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-950/30">
                  <div className="text-xs text-rose-700 dark:text-rose-300">გადაუხდელი (სულ)</div>
                  <div className="text-lg font-semibold text-rose-800 dark:text-rose-200">{formatMoney(s.money.unpaid)}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>გადახდილის წილი</span>
                  <span>{paidPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="size-4 text-sky-600" /> აქტიური შეკვეთები რუკაზე
            </CardTitle>
            <span className="text-xs text-muted-foreground">{s.mapPoints.length} ობიექტი</span>
          </CardHeader>
          <CardContent>
            {s.mapPoints.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ობიექტებს კოორდინატები არ აქვს. დაამატეთ ობიექტის ბარათზე.</p>
            ) : (
              <MapView
                height={300}
                markers={s.mapPoints.map((p) => ({
                  id: p.id,
                  lat: p.lat,
                  lng: p.lng,
                  color: STATUS_HEX[p.status],
                  label: `${p.number} · ${p.title}${p.clientName ? " · " + p.clientName : ""}`,
                  href: `/orders/${p.id}`,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600" /> გარანტია იწურება (30 დღე)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.warranty.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">უახლოეს 30 დღეში გარანტია არ იწურება</p>}
            {s.warranty.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="block rounded-lg border p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <div className="truncate text-sm font-medium">{o.title}</div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="truncate">{o.client?.name ?? o.number}</span>
                  <span className="font-medium text-amber-700">{formatDate(o.warrantyUntil)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">შემსრულებლების დატვირთვა</CardTitle>
        </CardHeader>
        <CardContent>
          {s.executorLoad.length === 0 ? (
            <p className="text-sm text-muted-foreground">შემსრულებლები არ არიან დამატებული</p>
          ) : (
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {s.executorLoad.map((e) => (
                <Link key={e.id} href={`/orders?assignee=${e.id}&status=active`} className="flex items-center gap-3">
                  <UserAvatar name={e.name} image={e.image} size="md" />
                  <div className="w-36 truncate text-sm font-medium">{e.name}</div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={cn("h-full rounded-full", e.active >= 5 ? "bg-rose-500" : e.active >= 3 ? "bg-amber-500" : "bg-sky-500")}
                      style={{ width: `${Math.round((e.active / s.maxLoad) * 100)}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs text-muted-foreground">{e.active} აქტიური</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {s.overdue.length > 0 && (
        <Card className="border-rose-200 dark:border-rose-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" /> ვადაგადაცილებული შეკვეთები
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={s.overdue} compact />
          </CardContent>
        </Card>
      )}
      <span className="hidden">
        <StatusBadge status="new" />
      </span>
    </div>
  );
}
