import { CalendarClock, Camera, MapPin, Timer, User } from "lucide-react";
import Link from "next/link";
import { OverdueBadge, PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { MyVisitControls } from "@/components/app/my-visit-controls";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, formatDuration, t } from "@/lib/i18n";
import { listMyOrders, type MyOrderItem } from "@/lib/orders";
import { isOverdue, orderContact, telHref } from "@/lib/order-utils";
import { tbilisiDayBounds, tbilisiTime, tbilisiToday } from "@/lib/schedule-utils";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "ჩემი შეკვეთები" };

function mapsHref(o: MyOrderItem) {
  if (o.site?.lat && o.site?.lng) return `https://maps.google.com/?q=${o.site.lat},${o.site.lng}`;
  const a = o.address ?? o.site?.address;
  return a ? `https://maps.google.com/?q=${encodeURIComponent(a)}` : null;
}

function OrderCard({ o, meId, highlight }: { o: MyOrderItem; meId: string; highlight?: boolean }) {
  const unseen = o.assignees.some((a) => a.userId === meId && !a.seenAt);
  const overdue = isOverdue(o);
  const requiredLeft = 0;
  const maps = mapsHref(o);
  const contact = orderContact(o);
  const active = o.status === "assigned" || o.status === "in_progress";
  const place = [o.client?.name, o.address ?? o.site?.address ?? o.site?.name].filter(Boolean).join(" · ");
  return (
    <article
      className={cn("ln-card border border-transparent p-4", highlight && "border-[#a5b5ed] md:border-[#7fc4a3]", unseen && !highlight && "border-[#a5b5ed]")}
      aria-label={`${o.number} ${o.title}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5 md:mb-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
        <StatusBadge status={o.status} />
        <SystemBadge system={o.systemType} className="order-last max-w-full whitespace-normal break-words px-1.5 py-0 text-[10px] md:order-none md:whitespace-nowrap" />
        {overdue && <OverdueBadge className="hidden md:inline-flex" />}
        {unseen && <span className="rounded-[5px] border border-[#dbe3fd] bg-[#eef2ff] px-1.5 py-[2px] text-[10px] font-medium text-[#3457d5]">ახალი დანიშვნა</span>}
      </div>
      <Link href={`/orders/${o.id}`} className="block max-md:break-words font-heading text-[17px] font-bold leading-snug tracking-[-0.01em] hover:text-[#3457d5]">
        {o.title}
      </Link>
      {place && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[14px] text-[#4a5a6c]">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {maps ? (
            <a href={maps} target="_blank" rel="noreferrer" className="line-clamp-2 hover:text-[#3457d5] hover:underline">
              {place}
            </a>
          ) : (
            <span className="line-clamp-2">{place}</span>
          )}
        </div>
      )}
      {contact.namedOnSite && (
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <User className="size-4 shrink-0" />
          <span className="break-words md:truncate">{contact.name}</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        {o.scheduledAt && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <CalendarClock className="size-4" /> {formatDate(o.scheduledAt, true)}
            {o.plannedMinutes ? ` · ${formatDuration(o.plannedMinutes)}` : ""}
          </span>
        )}
        {o.dueDate && <span className={cn(overdue && "font-semibold text-[#b13f32]")}><span className="md:hidden">{overdue ? "ვადაგადაცილებულია · " : "ვადა "}{formatDate(o.dueDate).slice(0, 5)}</span><span className="hidden md:inline">ვადა {formatDate(o.dueDate)}</span></span>}
        {o.priority !== "normal" && <PriorityLabel priority={o.priority} className={overdue ? "max-md:text-muted-foreground" : undefined} />}
        {active && o.requiresPhoto && (
          <span className="flex items-center gap-1 text-[12px] text-[#96610b]">
            <Camera className="size-3" /> ფოტო საჭიროა
          </span>
        )}
      </div>

      {active && (
        <MyVisitControls
          orderId={o.id}
          status={o.status}
          requiredLeft={requiredLeft}
          needsPhoto={o.requiresPhoto}
          phoneHref={telHref(contact.phone)}
          mapsHref={maps}
        />
      )}
    </article>
  );
}

const TABS = [
  { key: "new", label: "ახალი", empty: "ახალი დანიშნული შეკვეთა არ გაქვთ." },
  { key: "active", label: "მიმდინარე", empty: "დაწყებული სამუშაო არ გაქვთ. ღილაკი „დაწყება“ „ახალ“ ჩანართშია." },
  { key: "done", label: "ჩაბარდა", empty: "მენეჯერის შემოწმებას არაფერი ელოდება." },
  { key: "closed", label: "დახურული", empty: "დახურული შეკვეთები ჯერ არ არის." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function MyOrdersPage({ searchParams }: PageProps<"/my">) {
  const me = await requireUser(["executor", "manager", "admin"]);
  const sp = await searchParams;
  const all = await listMyOrders(me.id);
  const { start, end } = tbilisiDayBounds(tbilisiToday());
  const isToday = (o: MyOrderItem) => Boolean(o.scheduledAt && o.scheduledAt >= start && o.scheduledAt < end);

  // one tab per stage of the job, so a technician never scrolls past finished work to find the next one
  const buckets: Record<TabKey, MyOrderItem[]> = {
    new: all.filter((o) => o.status === "new" || o.status === "assigned"),
    active: all.filter((o) => o.status === "in_progress"),
    done: all.filter((o) => o.status === "done"),
    closed: all.filter((o) => o.status === "closed" || o.status === "cancelled").slice(0, 20),
  };
  const asked = TABS.find((t) => t.key === sp.tab)?.key;
  const tab: TabKey = asked ?? (buckets.active.length > 0 ? "active" : "new");
  const current = TABS.find((t) => t.key === tab)!;
  const items = buckets[tab];

  const onSite = (o: MyOrderItem) => o.visits.some((v) => v.userId === me.id && !v.endedAt);
  const groups: { title: string | null; items: MyOrderItem[]; highlight?: boolean }[] =
    tab === "new"
      ? [
          { title: "დღეს", items: items.filter(isToday) },
          { title: "შემდეგ", items: items.filter((o) => !isToday(o)) },
        ]
      : tab === "active"
        ? [
            { title: "ობიექტზე ხართ", items: items.filter(onSite), highlight: true },
            { title: "დაწყებული", items: items.filter((o) => !onSite(o)) },
          ]
        : [{ title: null, items }];
  const shown = groups.filter((g) => g.items.length > 0);
  const titled = shown.length > 1;

  const leftToday = [...buckets.new, ...buckets.active].filter(isToday).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t.nav.my} subtitle={`${tbilisiTime(new Date())} · დღეს დარჩენილი ${leftToday} ვიზიტი`} />

      <nav aria-label="შეკვეთების სტატუსი" className={cn("ln-card sticky top-[68px] z-10 grid-cols-4 gap-1 p-1.5", me.role === "executor" ? "hidden md:grid" : "grid")}>
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <Link
              key={x.key}
              href={`/my?tab=${x.key}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 transition-colors sm:flex-row sm:gap-1.5",
                on ? "bg-[#3457d5] text-white" : "text-[#4a5e73] hover:bg-[#f4f6fa]",
              )}
            >
              <span className="max-w-full truncate text-[12px] font-medium sm:text-[13px]">{x.label}</span>
              <span className={cn("tabular min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-[18px]", on ? "bg-white/20" : "bg-[#f1f4f9] text-[#617084]")}>
                {buckets[x.key].length}
              </span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="ln-card px-6 py-14 text-center text-sm text-muted-foreground">
          {all.length === 0 ? "დანიშნული შეკვეთები არ გაქვთ. როცა მენეჯერი შეკვეთას დაგინიშნავთ, აქ გამოჩნდება და შეტყობინებას მიიღებთ." : current.empty}
        </div>
      ) : (
        shown.map((g) => (
          <section key={g.title ?? "all"} className="space-y-2">
            {titled && g.title && (
              <h2 className="text-[13px] font-semibold text-[#617084]">
                {g.title} · {g.items.length}
              </h2>
            )}
            {g.items.map((o) => (
              <OrderCard key={o.id} o={o} meId={me.id} highlight={g.highlight} />
            ))}
          </section>
        ))
      )}

      {(tab === "new" || tab === "active") && items.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Timer className="size-3 shrink-0" /> „დაწყება“ იწყებს ვიზიტს, „სამუშაო შესრულებულია“ შეკვეთას მენეჯერს შესამოწმებლად გადასცემს.
        </p>
      )}
    </div>
  );
}
