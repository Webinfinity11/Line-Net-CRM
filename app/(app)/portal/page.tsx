import { CalendarClock, CircleCheck, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { portalStatusLabel, STATUS_COLORS, formatDate, t } from "@/lib/i18n";
import { listPortalOrders, requirePortalUser, type PortalOrder } from "@/lib/portal";
import { systemLabels } from "@/lib/systems";
import { cn } from "@/lib/utils";

export const metadata = { title: "ჩემი შეკვეთები" };

const OPEN = new Set(["new", "assigned", "in_progress"]);

function OrderCard({ o, category }: { o: PortalOrder; category: string | null }) {
  const place = o.site ? [o.site.name, o.address ?? o.site.address].filter(Boolean).join(" · ") : o.address;
  return (
    <article className="ln-card p-4" aria-label={`${o.number} ${o.title}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] text-[11px] font-medium", o.triaged ? STATUS_COLORS[o.status] : STATUS_COLORS.closed)}>
          <i className="size-[5px] rounded-full bg-current" aria-hidden />
          {portalStatusLabel(o.status, o.triaged)}
        </span>
        {category && <span className="rounded-[6px] bg-[#f1f4f9] px-1.5 py-[3px] text-[11px] text-[#617084]">{category}</span>}
        {o.priority === "urgent" && <span className="text-[11px] font-medium text-[#b13f32]">სასწრაფო</span>}
      </div>
      <h3 className="font-heading text-[16px] font-bold leading-snug tracking-[-0.01em]">{o.title}</h3>
      {place && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[#4a5a6c]">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-2">{place}</span>
        </div>
      )}
      {o.description && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">{o.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        <span>გაიგზავნა {formatDate(o.createdAt)}</span>
        {o.scheduledAt && OPEN.has(o.status) && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <CalendarClock className="size-3.5" /> ვიზიტი {formatDate(o.scheduledAt, true)}
          </span>
        )}
        {o.completedAt && (o.status === "done" || o.status === "closed") && (
          <span className="flex items-center gap-1 text-[#25815a]">
            <CircleCheck className="size-3.5" /> შესრულდა {formatDate(o.completedAt)}
          </span>
        )}
      </div>
    </article>
  );
}

export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const { company } = await requirePortalUser();
  const sp = await searchParams;
  const newButton = (
    <Button render={<Link href="/portal/new" />} className="h-11 sm:h-9">
      <Plus className="size-4" /> {t.order.new}
    </Button>
  );

  if (!company) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t.nav.my} />
        <div className="ln-card px-6 py-14 text-center text-sm text-muted-foreground">ანგარიში ჯერ კომპანიაზე არ არის მიბმული. დაუკავშირდით ლაინნეტს.</div>
      </div>
    );
  }

  const [orders, labels] = await Promise.all([listPortalOrders(company.id), systemLabels()]);
  const sentOrder = typeof sp.sent === "string" ? orders.find((o) => String(o.id) === sp.sent) : undefined;
  const open = orders.filter((o) => OPEN.has(o.status));
  const finished = orders.filter((o) => !OPEN.has(o.status)).slice(0, 30);
  const categoryOf = (o: PortalOrder) => (o.systemType ? (labels[o.systemType] ?? null) : null);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader kicker={company.name} title={t.nav.my} subtitle={`${open.length} მიმდინარე · ${orders.length} სულ`} actions={newButton} />

      {sentOrder && (
        <div role="status" className="ln-card flex items-center gap-2.5 px-4 py-3 text-[13px] text-[#25815a]">
          <CircleCheck className="size-4 shrink-0" /> მოთხოვნა გაგზავნილია — {sentOrder.number}. როცა ლაინნეტი მიიღებს, შეტყობინებას მიიღებთ.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="ln-card px-6 py-14 text-center text-sm text-muted-foreground">
          შეკვეთები ჯერ არ გაქვთ. „ახალი შეკვეთით“ მოთხოვნას ლაინნეტს გაუგზავნით, მისი სტატუსი კი აქ გამოჩნდება.
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold text-[#617084]">მიმდინარე · {open.length}</h2>
              {open.map((o) => (
                <OrderCard key={o.id} o={o} category={categoryOf(o)} />
              ))}
            </section>
          )}
          {finished.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[13px] font-semibold text-[#617084]">დასრულებული · {finished.length}</h2>
              {finished.map((o) => (
                <OrderCard key={o.id} o={o} category={categoryOf(o)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
