import { CalendarClock, Camera, MapPin, Navigation, Phone, Timer } from "lucide-react";
import Link from "next/link";
import { OverdueBadge, PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { MyVisitControls } from "@/components/app/my-visit-controls";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, formatDuration, t } from "@/lib/i18n";
import { listMyOrders, type MyOrderItem } from "@/lib/orders";
import { isOverdue } from "@/lib/order-utils";
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
  const myOpenVisit = o.visits.find((v) => v.userId === meId && !v.endedAt) ?? null;
  const requiredLeft = o.checklist.filter((c) => c.required && !c.done).length;
  const done = o.checklist.filter((c) => c.done).length;
  const maps = mapsHref(o);
  const phone = o.client?.phone?.replace(/\s+/g, "");
  const active = o.status === "assigned" || o.status === "in_progress";
  return (
    <article className={cn("rounded-2xl border bg-white p-4 dark:bg-neutral-900", highlight && "ring-2 ring-emerald-300", unseen && "border-blue-400")} aria-label={`${o.number} ${o.title}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
        <StatusBadge status={o.status} />
        <SystemBadge system={o.systemType} className="px-1.5 py-0 text-[10px]" />
        {overdue && <OverdueBadge />}
        {unseen && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">ახალი</span>}
        {o.requiresPhoto && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-200">
            <Camera className="size-3" /> ფოტო
          </span>
        )}
      </div>
      <Link href={`/orders/${o.id}`} className="block text-base font-semibold leading-snug hover:text-blue-700">
        {o.title}
      </Link>
      <div className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
        {o.client && <div className="truncate">{o.client.name}{o.site ? ` · ${o.site.name}` : ""}</div>}
        {(o.address || o.site?.address) && (
          <div className="flex items-center gap-1 truncate">
            <MapPin className="size-3.5 shrink-0" /> {o.address ?? o.site?.address}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {o.scheduledAt && (
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <CalendarClock className="size-3.5" /> {formatDate(o.scheduledAt, true)}
              {o.plannedMinutes ? ` · ${formatDuration(o.plannedMinutes)}` : ""}
            </span>
          )}
          {o.dueDate && <span className={cn(overdue && "font-semibold text-rose-600")}>ვადა {formatDate(o.dueDate)}</span>}
          <PriorityLabel priority={o.priority} />
          {o.checklist.length > 0 && (
            <span className={cn(requiredLeft > 0 ? "text-amber-700" : "text-emerald-700")}>
              ჩეკ-ლისტი {done}/{o.checklist.length}
              {requiredLeft > 0 ? ` · ${requiredLeft} სავალდებულო` : ""}
            </span>
          )}
        </div>
      </div>

      {active && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a
            href={phone ? `tel:${phone}` : undefined}
            aria-disabled={!phone}
            className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium", phone ? "hover:bg-slate-50" : "pointer-events-none opacity-40")}
          >
            <Phone className="size-4" /> დარეკვა
          </a>
          <a
            href={maps ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!maps}
            className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium", maps ? "hover:bg-slate-50" : "pointer-events-none opacity-40")}
          >
            <Navigation className="size-4" /> მარშრუტი
          </a>
          <Link href={`/orders/${o.id}#attachments`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium hover:bg-slate-50">
            <Camera className="size-4" /> ფოტო
          </Link>
        </div>
      )}
      {active && (
        <div className="mt-2">
          <MyVisitControls orderId={o.id} openVisitStartedAt={myOpenVisit?.startedAt ?? null} requiredLeft={requiredLeft} needsPhoto={o.requiresPhoto} />
        </div>
      )}
    </article>
  );
}

export default async function MyOrdersPage() {
  const me = await requireUser();
  const all = await listMyOrders(me.id);
  const { start, end } = tbilisiDayBounds(tbilisiToday());
  const active = all.filter((o) => o.status === "assigned" || o.status === "in_progress" || o.status === "new");
  const current = active.filter((o) => o.visits.some((v) => v.userId === me.id && !v.endedAt));
  const todays = active.filter((o) => !current.includes(o) && o.scheduledAt && o.scheduledAt >= start && o.scheduledAt < end);
  const rest = active.filter((o) => !current.includes(o) && !todays.includes(o));
  const done = all.filter((o) => o.status === "done");
  const closed = all.filter((o) => o.status === "closed" || o.status === "cancelled").slice(0, 10);

  const Section = ({ title, items, hint, highlight }: { title: string; items: MyOrderItem[]; hint?: string; highlight?: boolean }) =>
    items.length === 0 && !hint ? null : (
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {title} · {items.length}
        </h2>
        {items.length === 0 && hint && <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-muted-foreground dark:bg-neutral-900">{hint}</p>}
        {items.map((o) => (
          <OrderCard key={o.id} o={o} meId={me.id} highlight={highlight} />
        ))}
      </section>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <PageHeader title={t.nav.my} subtitle={`${tbilisiTime(new Date())} · ${active.length} აქტიური`} />
      {all.length === 0 && (
        <div className="rounded-2xl border bg-white py-16 text-center text-sm text-muted-foreground dark:bg-neutral-900">
          დანიშნული შეკვეთები არ გაქვთ. როცა მენეჯერი დაგინიშნავთ, აქ გამოჩნდება და შეტყობინებას მიიღებთ.
        </div>
      )}
      {current.length > 0 && (
        <Section title="მიმდინარე ვიზიტი" items={current} highlight />
      )}
      <Section title="დღეს" items={todays} hint={active.length ? "დღეს დაგეგმილი ვიზიტი არ გაქვთ. ქვემოთ სხვა აქტიური შეკვეთებია." : undefined} />
      <Section title="სხვა აქტიური" items={rest} />
      <Section title="ჩაბარებული, ელოდება მენეჯერის შემოწმებას" items={done} />
      <Section title="დახურული" items={closed} />
      {all.length > 0 && (
        <p className="flex items-center gap-1 text-center text-xs text-muted-foreground">
          <Timer className="size-3" /> „მივედი“ იწყებს ვიზიტს, „სამუშაო შესრულებულია“ აბარებს შეკვეთას მენეჯერს.
        </p>
      )}
    </div>
  );
}
