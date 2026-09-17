import { CalendarClock, Camera, MapPin, Timer } from "lucide-react";
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
  const requiredLeft = o.checklist.filter((c) => c.required && !c.done).length;
  const done = o.checklist.filter((c) => c.done).length;
  const maps = mapsHref(o);
  const phone = o.client?.phone?.replace(/\s+/g, "");
  const active = o.status === "assigned" || o.status === "in_progress";
  const place = [o.client?.name, o.address ?? o.site?.address ?? o.site?.name].filter(Boolean).join(" · ");
  return (
    <article
      className={cn("rounded-xl border border-border bg-white p-4 dark:bg-neutral-900", highlight && "border-[#7fc4a3] shadow-[0_0_0_2px_#d8eddf]", unseen && !highlight && "border-[#a5b5ed]")}
      aria-label={`${o.number} ${o.title}`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
        <StatusBadge status={o.status} />
        <SystemBadge system={o.systemType} className="px-1.5 py-0 text-[10px]" />
        {overdue && <OverdueBadge />}
        {unseen && <span className="rounded-[5px] border border-[#dbe3fd] bg-[#eef2ff] px-1.5 py-[2px] text-[10px] font-medium text-[#3457d5]">ახალი დანიშვნა</span>}
      </div>
      <Link href={`/orders/${o.id}`} className="block text-[16px] font-semibold leading-snug hover:text-[#3457d5]">
        {o.title}
      </Link>
      {place && (
        <div className="mt-1 flex items-start gap-1 text-[13px] text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          {maps ? (
            <a href={maps} target="_blank" rel="noreferrer" className="line-clamp-2 hover:text-[#3457d5] hover:underline">
              {place}
            </a>
          ) : (
            <span className="line-clamp-2">{place}</span>
          )}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
        {o.scheduledAt && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <CalendarClock className="size-3.5" /> {formatDate(o.scheduledAt, true)}
            {o.plannedMinutes ? ` · ${formatDuration(o.plannedMinutes)}` : ""}
          </span>
        )}
        {o.dueDate && <span className={cn(overdue && "font-semibold text-[#b13f32]")}>ვადა {formatDate(o.dueDate)}</span>}
        {o.priority !== "normal" && <PriorityLabel priority={o.priority} />}
        {active && (o.checklist.length > 0 || o.requiresPhoto) && (
          <span className={cn("flex items-center gap-1", requiredLeft > 0 || o.requiresPhoto ? "text-[#96610b]" : "text-[#23764f]")}>
            {o.checklist.length > 0 && (
              <>
                ჩეკ-ლისტი {done}/{o.checklist.length}
                {requiredLeft > 0 ? ` · ${requiredLeft} სავალდებულო` : ""}
              </>
            )}
            {o.requiresPhoto && (
              <>
                {o.checklist.length > 0 ? " · " : ""}
                <Camera className="size-3" /> ფოტო საჭიროა
              </>
            )}
          </span>
        )}
      </div>

      {active && (
        <MyVisitControls
          orderId={o.id}
          requiredLeft={requiredLeft}
          needsPhoto={o.requiresPhoto}
          phoneHref={phone ? `tel:${phone}` : null}
          mapsHref={maps}
        />
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

  const Section = ({ title, items, highlight }: { title: string; items: MyOrderItem[]; highlight?: boolean }) =>
    items.length === 0 ? null : (
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          {title} · {items.length}
        </h2>
        {items.map((o) => (
          <OrderCard key={o.id} o={o} meId={me.id} highlight={highlight} />
        ))}
      </section>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <PageHeader title={t.nav.my} subtitle={`${tbilisiTime(new Date())} · ${active.length} აქტიური`} />
      {all.length === 0 && (
        <div className="rounded-xl border border-dashed bg-white py-16 text-center text-sm text-muted-foreground dark:bg-neutral-900">
          დანიშნული შეკვეთები არ გაქვთ. როცა მენეჯერი დაგინიშნავთ, აქ გამოჩნდება და შეტყობინებას მიიღებთ.
        </div>
      )}
      {current.length > 0 && (
        <Section title="მიმდინარე ვიზიტი" items={current} highlight />
      )}
      <Section title="დღეს" items={todays} />
      <Section title="სხვა აქტიური" items={rest} />
      <Section title="ჩაბარებული, ელოდება მენეჯერის შემოწმებას" items={done} />
      <Section title="დახურული" items={closed} />
      {all.length > 0 && (
        <p className="flex items-center gap-1 text-center text-xs text-muted-foreground">
          <Timer className="size-3" /> „სამუშაო შესრულებულია“ აბარებს შეკვეთას მენეჯერს შესამოწმებლად.
        </p>
      )}
    </div>
  );
}
