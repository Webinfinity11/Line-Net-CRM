import { executorBucket, executorProgress } from "@/lib/workflow-view";
import { assigneeStage } from "@/lib/team-flow";
import { CalendarClock, MapPin, MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { OverdueBadge, PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { MyVisitControls } from "@/components/app/my-visit-controls";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, formatDuration, t } from "@/lib/i18n";
import { unreadCommentOrderIds } from "@/lib/notify";
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

function OrderCard({ o, meId, highlight, chat }: { o: MyOrderItem; meId: string; highlight?: boolean; chat?: boolean }) {
  const unseen = o.assignees.some((a) => a.userId === meId && !a.seenAt);
  const overdue = isOverdue(o);
  const requiredLeft = o.checklist.filter(item => item.required && !item.done).length;
  const progress = executorProgress(o, meId);
  const maps = mapsHref(o);
  const contact = orderContact(o);
  const active = o.status === "assigned" || o.status === "in_progress";
  const place = [o.client?.name, o.address ?? o.site?.address ?? o.site?.name].filter(Boolean).join(" · ");
  return (
    <article
      className={cn("ln-card border border-transparent p-4", highlight && "border-[#a5b5ed] md:border-[#7fc4a3]", unseen && !highlight && "border-[#a5b5ed]")}
      aria-label={`${o.number} ${o.title}`}
    >
      <Link
        href={`/orders/${o.id}`}
        aria-label={`${o.number} ${o.title}`}
        className="relative -mx-4 -mt-4 block cursor-pointer rounded-t-[inherit] py-4 pl-4 pr-[44px] transition-colors hover:bg-[#f8faff] active:bg-[#eef2ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457d5] after:pointer-events-none after:absolute after:right-4 after:top-1/2 after:-translate-y-1/2 after:text-[24px] after:text-[#3457d5] after:content-['›']"
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5 md:mb-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
          <StatusBadge status={o.status} />
          <SystemBadge system={o.systemType} className="order-last max-w-full whitespace-normal break-words px-1.5 py-0 text-[10px] md:order-none md:whitespace-nowrap" />
          {overdue && <OverdueBadge />}
          {unseen && <span className="rounded-[5px] border border-[#dbe3fd] bg-[#eef2ff] px-1.5 py-[2px] text-[10px] font-medium text-[#3457d5]">ახალი დანიშვნა</span>}
        </div>
        <span className="ln-link block break-words font-heading text-[17px] font-bold leading-snug tracking-[-0.01em]">
          {o.title}
        </span>
        {place && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[14px] text-[#4a5a6c]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2 min-w-0 break-words">{place}</span>
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
          {o.dueDate && <span><span className="md:hidden">ვადა {formatDate(o.dueDate).slice(0, 5)}</span><span className="hidden md:inline">ვადა {formatDate(o.dueDate)}</span></span>}
          <PriorityLabel priority={o.priority} />
        </div>

        <div className="mt-3 border-t border-[#e6ebf2] pt-3"><p className="text-[13px] font-semibold text-[#3457d5]">{progress.title}</p><p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{progress.detail}</p><p className="mt-1 text-[12px]">გუნდში ჩაბარებულია: {o.assignees.filter(a => a.doneAt).length} / {o.assignees.length}</p></div>
        <ul className="mt-2 text-[12px]">{o.assignees.map(a => <li key={a.userId}>{a.user.name} · {assigneeStage(a, o.visits)}</li>)}</ul>
      </Link>
      {chat && (
        <Link
          href={`/orders/${o.id}#comments`}
          aria-label="ახალი შეტყობინება ჩატში"
          title="ახალი შეტყობინება ჩატში"
          className="relative inline-flex size-[44px] items-center justify-center rounded-lg border border-[#dbe1ec] text-[#3457d5] transition-colors hover:bg-[#f8faff] active:bg-[#eef2ff]"
        >
          <MessageCircle className="size-4" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-[#3457d5]" />
        </Link>
      )}
      {active && (
        <MyVisitControls
          startedByMe={o.visits.some(v => v.userId === meId && !v.endedAt)}
          doneByMe={Boolean(o.assignees.find(a => a.userId === meId)?.doneAt)}
          orderId={o.id}
          status={o.status}
          requiredLeft={requiredLeft}
          phoneHref={telHref(contact.phone)}
          mapsHref={maps}
        />
      )}
    </article>
  );
}

const TABS = [
  { key: "new", label: "დასაწყები", empty: "ახალი დანიშნული შეკვეთა არ გაქვთ." },
  { key: "active", label: "მიმდინარე", empty: "დაწყებული სამუშაო არ გაქვთ. ღილაკი „დაწყება“ „დასაწყებ“ ჩანართშია." },
  { key: "done", label: "ჩაბარებული", empty: "თქვენ მიერ ჩაბარებული სამუშაო ჯერ არ არის." },
  { key: "closed", label: "დახურული", empty: "დახურული შეკვეთები ჯერ არ არის." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function MyOrdersPage({ searchParams }: PageProps<"/my">) {
  const me = await requireUser(["executor", "manager", "admin"]);
  const sp = await searchParams;
  const [all, unreadChat] = await Promise.all([listMyOrders(me.id), unreadCommentOrderIds(me.id)]);
  const { start, end } = tbilisiDayBounds(tbilisiToday());
  const isToday = (o: MyOrderItem) => Boolean(o.scheduledAt && o.scheduledAt >= start && o.scheduledAt < end);

  // one tab per stage of the job, so a technician never scrolls past finished work to find the next one
  const buckets: Record<TabKey, MyOrderItem[]> = {
    new: all.filter((o) => executorBucket(o, me.id) === "new"),
    active: all.filter((o) => executorBucket(o, me.id) === "active"),
    done: all.filter((o) => executorBucket(o, me.id) === "done"),
    closed: all.filter((o) => executorBucket(o, me.id) === "closed").slice(0, 20),
  };
  const asked = TABS.find((t) => t.key === sp.tab)?.key;
  const tab: TabKey = asked ?? (buckets.active.length > 0 ? "active" : "new");
  const current = TABS.find((t) => t.key === tab)!;
  const items = buckets[tab];

  // Keep the database's newest-first order across dates and workflow stages.
  const groups: { title: string | null; items: MyOrderItem[]; highlight?: boolean }[] =
    [{ title: null, items, highlight: tab === "active" }];
  const shown = groups.filter((g) => g.items.length > 0);
  const titled = shown.length > 1;

  const leftToday = [...buckets.new, ...buckets.active].filter(isToday).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/my/board" className="text-[13px] text-[#3457d5]">ყველა შეკვეთა</Link>
      <PageHeader title={t.nav.my} subtitle={`${tbilisiTime(new Date())} · დღეს დარჩენილი ${leftToday} ვიზიტი`} />

      <div className={cn("sticky top-16 z-10 bg-[#f4f6fa] py-2 dark:bg-neutral-900", me.role === "executor" && "hidden md:block")}>
      <nav aria-label="შეკვეთების სტატუსი" className="ln-card grid grid-cols-4 gap-1 p-1.5">
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <Link
              key={x.key}
              href={`/my?tab=${x.key}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 transition-colors sm:flex-row sm:gap-1.5",
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
      </div>

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
              <OrderCard key={o.id} o={o} meId={me.id} highlight={g.highlight} chat={unreadChat.has(o.id)} />
            ))}
          </section>
        ))
      )}


    </div>
  );
}
