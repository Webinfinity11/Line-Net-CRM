import { monthOptions, parseMonth } from "@/lib/month-filter";
import { oldestOrderDate } from "@/lib/orders";
import { WorkflowProgress } from "@/components/app/workflow-progress";
import { PriorityLabel } from "@/components/app/badges";
import { ArrowRight, CalendarClock, CircleCheck, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { toMtavruli } from "@/lib/mtavruli";
import { portalStatusLabel, STATUS_COLORS, formatDate, t } from "@/lib/i18n";
import { listPortalOrders, listPortalSites, requirePortalUser, type PortalOrder } from "@/lib/portal";
import { systemLabels } from "@/lib/systems";
import { cn } from "@/lib/utils";
import { PortalFilters } from "@/components/app/portal-filters";
import { countPortalTabs, parsePortalTab, portalTabOf } from "@/lib/portal-tabs";

export const metadata = { title: "ჩემი შეკვეთები" };


function OrderCard({ o, category }: { o: PortalOrder; category: string | null }) {
  const place = o.site ? [o.site.name, o.address ?? o.site.address].filter(Boolean).join(" · ") : o.address;
  return (
    <article className="ln-card ln-card-link group p-4 [overflow-wrap:anywhere]" aria-label={`${o.number} ${o.title}`}>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] text-[11px] font-medium", o.triaged ? STATUS_COLORS[o.status] : STATUS_COLORS.closed)}>
            <i className="size-[5px] rounded-full bg-current" aria-hidden />
            {o.triaged && o.status === "assigned" && !o.scheduledAt ? "ვიზიტის დრო ზუსტდება" : portalStatusLabel(o.status, o.triaged)}
          </span>
          {category && <span className="rounded-[6px] bg-muted px-1.5 py-[3px] text-[11px] text-muted-foreground">{category}</span>}
          <PriorityLabel priority={o.priority} />
        </div>
        <h3 className="font-heading text-[16px] font-bold leading-snug tracking-[-0.01em] text-primary underline-offset-4 group-hover:underline">
          <Link href={`/portal/orders/${o.id}`} aria-label={`${o.number} — ${o.title} — დეტალურად`} className="ln-row-link-anchor">{o.title}</Link>
        </h3>
        {place && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[#4a5a6c] dark:text-[var(--ln-strong)]">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2">{place}</span>
          </div>
        )}
        {o.description && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted-foreground">{o.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span>გაიგზავნა {formatDate(o.createdAt)}</span>
          {o.scheduledAt && ["new", "assigned", "in_progress"].includes(o.status) && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <CalendarClock className="size-3.5" /> ვიზიტი {formatDate(o.scheduledAt, true)}
            </span>
          )}
          {o.completedAt && (o.status === "done" || o.status === "closed") && (
            <span className="flex items-center gap-1 text-[#25815a] dark:text-[var(--ln-success)]">
              <CircleCheck className="size-3.5" /> შესრულდა {formatDate(o.completedAt)}
            </span>
          )}
        </div>
        <WorkflowProgress status={o.status} triaged={o.triaged} scheduled={Boolean(o.scheduledAt)} compact />
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={`/portal/orders/${o.id}`} className={cn(buttonVariants({ variant: "outline" }), "relative z-10 h-11 w-full gap-2 whitespace-nowrap sm:w-auto")}>{toMtavruli("დეტალურად")} <ArrowRight className="size-4" /></Link>
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

  const tab = parsePortalTab(typeof sp.tab === "string" ? sp.tab : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const site = typeof sp.site === "string" && /^\d+$/.test(sp.site) ? Number(sp.site) : undefined;
  const siteId = site && Number.isSafeInteger(site) && site <= 2147483647 ? site : undefined;
  const month = typeof sp.month === "string" && parseMonth(sp.month) ? sp.month : undefined;
  const [orders, labels, sites, oldest] = await Promise.all([listPortalOrders(company.id, { q, siteId, month }), systemLabels(), listPortalSites(company.id), oldestOrderDate(company.id)]);
  const sentOrder = typeof sp.sent === "string" ? orders.find((o) => String(o.id) === sp.sent) : undefined;
  const counts = countPortalTabs(orders);
  const visibleOrders = tab === "all" ? orders : orders.filter((o) => portalTabOf(o.status, o.triaged) === tab);
  const categoryOf = (o: PortalOrder) => (o.systemType ? (labels[o.systemType] ?? null) : null);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader kicker={company.name} title={t.nav.my} subtitle={`${counts.sent + counts.planned + counts.progress} მიმდინარე · ${orders.length} სულ`} actions={newButton} />

      {sentOrder && (
        <div role="status" className="ln-card flex items-center gap-2.5 px-4 py-3 text-[13px] text-[#25815a] dark:text-[var(--ln-success)]">
          <CircleCheck className="size-4 shrink-0" /> მოთხოვნა გაგზავნილია — {sentOrder.number}. როცა ლაინნეტი მიიღებს, შეტყობინებას მიიღებთ.
        </div>
      )}

      <PortalFilters month={month ?? ""} months={monthOptions(oldest, new Date())} tab={tab} q={q} siteId={siteId} counts={counts} sites={sites.map(({ id, name, address }) => ({ id, name, address }))} />
      {visibleOrders.length === 0 ? (
        <div className="ln-card px-6 py-14 text-center text-sm text-muted-foreground">
          {q || siteId || month ? "ვერაფერი მოიძებნა" : "შეკვეთა არ არის"}
        </div>
      ) : (
        <section className="space-y-2" aria-label="შეკვეთები">
          {visibleOrders.map((o) => <OrderCard key={o.id} o={o} category={categoryOf(o)} />)}
        </section>
      )}
    </div>
  );
}
