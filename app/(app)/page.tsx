import {
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Inbox,
  Mail,
  MapPinned,
  ShieldCheck,
  Siren,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PriorityLabel } from "@/components/app/badges";
import { StatusDonut, WeeklyBars } from "@/components/app/dashboard-charts";
import { MapView } from "@/components/app/map-view";
import { OrderTable } from "@/components/app/order-table";
import { PageHeader } from "@/components/app/page-header";
import { UserAvatar } from "@/components/app/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_HEX,
  STATUS_LABELS,
  STATUS_ORDER,
  formatDate,
  formatMoney,
  t,
} from "@/lib/i18n";
import { getDashboardStats, type DateRange } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "დაფა" };

const RANGES: { key: DateRange; label: string; prevLabel: string }[] = [
  { key: "today", label: t.common.today, prevLabel: "vs გუშინ" },
  { key: "week", label: t.common.week, prevLabel: "vs წინა კვირა" },
  { key: "month", label: t.common.month, prevLabel: "vs წინა თვე" },
];

const CAPACITY = 8;

function trendOf(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function timeOf(d: Date) {
  return new Intl.DateTimeFormat("ka-GE", {
    timeZone: "Asia/Tbilisi",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/my");
  const sp = await searchParams;
  const rangeDef = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const range = rangeDef.key;
  const s = await getDashboardStats(range);

  const inProgress = (s.counts.assigned ?? 0) + (s.counts.in_progress ?? 0);
  const stat = [
    {
      label: "ახალი",
      value: s.counts.new ?? 0,
      icon: ClipboardList,
      tone: "bg-blue-50 text-blue-600",
      href: "/orders?status=new",
      trend: trendOf(s.created, s.previous.created),
    },
    {
      label: "დანიშნული + მიმდინარე",
      value: inProgress,
      icon: Clock3,
      tone: "bg-indigo-50 text-indigo-600",
      href: "/orders?status=active",
      trend: null,
    },
    {
      label: "შესრულებული",
      value: s.completed,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
      href: "/orders?status=done",
      trend: trendOf(s.completed, s.previous.completed),
    },
    {
      label: "ვადაგადაცილებული (სულ)",
      value: s.overdueCount,
      icon: AlertTriangle,
      tone: "bg-amber-50 text-amber-600",
      href: "/orders?overdue=1",
      trend: null,
    },
  ];

  const donut = STATUS_ORDER.map((k) => ({
    name: STATUS_LABELS[k],
    value: s.counts[k] ?? 0,
    color: STATUS_HEX[k],
  }));
  const total = donut.reduce((a, b) => a + b.value, 0);
  const collected = s.money.paid + s.money.unpaid;
  const paidPct =
    collected > 0 ? Math.round((s.money.paid / collected) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="დაფა"
        subtitle="სერვისის ოპერაციების მიმოხილვა"
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {formatDate(new Date())}
            </span>
            <div className="flex rounded-xl border bg-white p-0.5 dark:bg-neutral-900">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/?range=${r.key}`}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-heading text-[12.5px] font-medium uppercase tracking-wide transition-colors",
                    r.key === range
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 dark:text-neutral-300",
                  )}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      {/* Needs action today */}
      <section
        aria-labelledby="needs-action"
        className="rounded-2xl border border-blue-100 bg-white p-4 dark:bg-neutral-900"
      >
        <h2
          id="needs-action"
          className="mb-3 text-sm font-semibold text-slate-700"
        >
          მოქმედება სჭირდება
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile
            href="/orders?status=new&priority=urgent"
            icon={<Siren className="size-4" />}
            tone="rose"
            title="სასწრაფო დაუნიშნავი"
            count={s.urgentUnassigned.length}
            empty="სასწრაფო დაუნიშნავი შეკვეთა არ არის"
            items={s.urgentUnassigned.map((o) => ({
              id: o.id,
              label: o.title,
              sub: o.client?.name ?? o.number,
            }))}
          />
          <ActionTile
            href="/orders?overdue=1"
            icon={<AlertTriangle className="size-4" />}
            tone="amber"
            title="ვადაგადაცილებული"
            count={s.overdueCount}
            empty="ვადაგადაცილებული არ არის"
            items={s.overdue.map((o) => ({
              id: o.id,
              label: o.title,
              sub: `${o.client?.name ?? o.number} · ${formatDate(o.dueDate)}`,
            }))}
          />
          <ActionTile
            href="/schedule"
            icon={<Clock3 className="size-4" />}
            tone="blue"
            title="დღევანდელი ვიზიტები"
            count={s.today.length}
            empty="დღეს ვიზიტი არ არის დაგეგმილი. დაუგეგმავი შეკვეთები განრიგშია."
            items={s.today.map((o) => ({
              id: o.id,
              label: o.title,
              sub: `${o.scheduledAt ? timeOf(o.scheduledAt) : ""} · ${o.assignees.map((a) => a.user.name.split(" ")[0]).join(", ") || "დაუნიშნავი"}`,
            }))}
          />
          <ActionTile
            href="/orders?status=done"
            icon={<CheckCircle2 className="size-4" />}
            tone="emerald"
            title="ჩასაბარებელი (შესამოწმებელი)"
            count={s.awaitingClosure.length}
            empty="შესამოწმებელი შეკვეთა არ არის"
            items={s.awaitingClosure.map((o) => ({
              id: o.id,
              label: o.title,
              sub: `${o.assignees.map((a) => a.user.name.split(" ")[0]).join(", ")} · ${formatDate(o.completedAt)}`,
            }))}
          />
        </div>
        {s.paymentReviewCount > 0 && (
          <Link
            href="/orders?status=all&review=1"
            className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
          >
            <Wallet className="size-3.5" /> {s.paymentReviewCount} შეკვეთაზე
            ნაწილობრივი გადახდის თანხა დასაზუსტებელია (ძველი მონაცემები)
          </Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stat.map((x) => (
          <Link key={x.label} href={x.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-4 px-5 py-1">
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-full",
                    x.tone,
                  )}
                >
                  <x.icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-muted-foreground">{x.label}</div>
                  <div className="font-heading text-[28px] font-bold leading-tight">
                    {x.value}
                  </div>
                </div>
                {x.trend !== null && (
                  <div className="shrink-0 border-l pl-3 text-right">
                    <div
                      className={cn(
                        "flex items-center justify-end gap-0.5 text-sm font-semibold",
                        x.trend >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {x.trend >= 0 ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownRight className="size-4" />
                      )}
                      {Math.abs(x.trend)}%
                    </div>
                    <div className="whitespace-nowrap text-[10.5px] text-muted-foreground">
                      {rangeDef.prevLabel}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr_1fr]">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>შეკვეთები სტატუსებით</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                ამ პერიოდში შეკვეთები არ არის
              </p>
            ) : (
              <StatusDonut data={donut} total={total} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>კვირის დინამიკა</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyBars data={s.weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle>დღევანდელი განრიგი</CardTitle>
            <Link
              href="/schedule"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              განრიგი <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {s.today.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                დღეს ვადა არცერთ შეკვეთას არ აქვს
              </p>
            )}
            {s.today.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800"
              >
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ background: STATUS_HEX[o.status] }}
                />
                <div className="w-12 shrink-0 text-xs font-semibold text-slate-700">
                  {o.scheduledAt ? timeOf(o.scheduledAt) : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{o.title}</span>
                    {o.priority === "urgent" && <span className="shrink-0 text-[10px] font-semibold text-rose-600">სასწრაფო</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.client?.name ?? "—"}
                    {" · "}
                    {o.assignees.map((a) => a.user.name.split(" ")[0]).join(", ") || "დაუნიშნავი"}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle>ბოლო შეკვეთები</CardTitle>
            <Link
              href="/orders"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              ყველა <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={s.recent} compact />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-1">
              <CardTitle>შემოსული წერილები</CardTitle>
              <Link
                href="/inbox"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                ყველა <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl bg-blue-50/70 p-3 dark:bg-blue-950/30">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Mail className="size-5" />
                </div>
                <div className="text-xs leading-snug">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    მოთხოვნები Microsoft 365-დან
                  </div>
                  <div className="text-muted-foreground">
                    წერილები ავტომატურად ხდება შეკვეთა და აქ ჩნდება
                    დასამუშავებლად.
                  </div>
                </div>
              </div>
              {s.inbox.length === 0 && (
                <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Inbox className="size-4" /> დაუმუშავებელი წერილები არ არის
                </p>
              )}
              {s.inbox.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800"
                >
                  <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {o.emailSubject ?? o.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.emailFrom}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeOf(o.emailReceivedAt ?? o.createdAt)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>თანხები</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-slate-50/60 p-3 dark:bg-neutral-800/40">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                      ₾
                    </span>{" "}
                    შემოსული
                  </div>
                  <div className="font-heading text-lg font-bold">
                    {formatMoney(s.money.paid)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeDef.label}
                  </div>
                </div>
                <div className="rounded-xl border bg-slate-50/60 p-3 dark:bg-neutral-800/40">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="flex size-6 items-center justify-center rounded-md bg-rose-100 text-rose-700">
                      ₾
                    </span>{" "}
                    გადაუხდელი
                  </div>
                  <div className="font-heading text-lg font-bold">
                    {formatMoney(s.money.unpaid)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">სულ</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">გადახდის მაჩვენებელი</span>
                  <span className="font-semibold">{paidPct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {formatMoney(s.money.paid)} მიღებულია /{" "}
                  {formatMoney(collected)} სულ
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle className="flex items-center gap-2">
              <MapPinned className="size-4 text-blue-600" /> აქტიური შეკვეთები
              რუკაზე
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {s.mapPoints.length} ობიექტი
            </span>
          </CardHeader>
          <CardContent>
            {s.mapPoints.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                ობიექტებს კოორდინატები არ აქვს. გახსენით კლიენტი → ობიექტი →
                „რუკაზე მონიშვნა“.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_230px]">
                <MapView
                  height={360}
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
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {(["new", "assigned", "in_progress"] as const).map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: STATUS_HEX[k] }}
                        />{" "}
                        {STATUS_LABELS[k]}
                      </span>
                    ))}
                  </div>
                  <ol className="max-h-[320px] space-y-1 overflow-y-auto pr-1 text-xs">
                    {s.mapPoints.map((p, i) => (
                      <li key={p.id}>
                        <Link
                          href={`/orders/${p.id}`}
                          className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50"
                        >
                          <span
                            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                            style={{ background: STATUS_HEX[p.status] }}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {p.siteName ?? p.clientName}
                            </span>
                            <span className="block truncate text-muted-foreground">
                              {p.title}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-1">
              <CardTitle>შემსრულებლების დატვირთვა</CardTitle>
              <Link
                href="/settings/users"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                გუნდი <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.executorLoad.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  შემსრულებლები არ არიან დამატებული
                </p>
              )}
              {s.executorLoad.map((e) => {
                const pct = Math.min(
                  100,
                  Math.round((e.active / CAPACITY) * 100),
                );
                return (
                  <Link
                    key={e.id}
                    href={`/orders?assignee=${e.id}&status=active`}
                    className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50 dark:hover:bg-neutral-800"
                  >
                    <UserAvatar name={e.name} image={e.image} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{e.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.active}/{CAPACITY} · <span className="font-semibold text-foreground">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
                        <div
                          className={pct >= 90 ? "h-full rounded-full bg-rose-500" : pct >= 60 ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-blue-500"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> გარანტია
                იწურება
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.warranty.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  უახლოეს 30 დღეში გარანტია არ იწურება
                </p>
              )}
              {s.warranty.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="block rounded-xl border p-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800"
                >
                  <div className="truncate text-sm font-medium">{o.title}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">
                      {o.client?.name ?? o.number}
                    </span>
                    <span className="font-medium text-amber-700">
                      {formatDate(o.warrantyUntil)}
                    </span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {s.overdue.length > 0 && (
        <Card className="ring-rose-200 dark:ring-rose-900">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-4" /> ვადაგადაცილებული შეკვეთები
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <OrderTable orders={s.overdue} compact />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActionTile({
  href,
  icon,
  tone,
  title,
  count,
  empty,
  items,
}: {
  href: string;
  icon: React.ReactNode;
  tone: "rose" | "amber" | "blue" | "emerald";
  title: string;
  count: number;
  empty: string;
  items: { id: number; label: string; sub: string }[];
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[tone];
  return (
    <div className="flex flex-col rounded-xl border p-3">
      <Link href={href} className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-md ring-1",
            tones,
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
            count > 0 ? tones : "bg-slate-50 text-slate-500 ring-slate-200",
          )}
        >
          {count}
        </span>
      </Link>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 4).map((i) => (
            <li key={i.id}>
              <Link
                href={`/orders/${i.id}`}
                className="block rounded-md px-1.5 py-1 hover:bg-slate-50"
              >
                <span className="block truncate text-xs font-medium">
                  {i.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {i.sub}
                </span>
              </Link>
            </li>
          ))}
          {count > 4 && (
            <li>
              <Link
                href={href}
                className="px-1.5 text-xs text-blue-600 hover:underline"
              >
                კიდევ {count - 4} →
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
