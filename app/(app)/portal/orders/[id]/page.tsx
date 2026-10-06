import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { PortalOrderEditDialog } from "./edit-dialog";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalPhotoGallery } from "@/components/app/portal-photo-gallery";
import { WorkflowProgress } from "@/components/app/workflow-progress";
import { getPortalOrder, listPortalSites, requirePortalUser } from "@/lib/portal";
import { formatDate, portalStatusLabel, STATUS_COLORS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const loadOrder = cache(async (rawId: string) => {
  const { company } = await requirePortalUser();
  const id = Number(rawId);
  if (!company || !/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) notFound();
  const order = await getPortalOrder(id, company.id);
  if (!order) notFound();
  const editable = order.status === "new" || order.status === "assigned";
  const [details] = editable ? await db.select({ priority: orders.priority }).from(orders)
    .where(and(eq(orders.id, id), eq(orders.clientId, company.id))) : [];
  const sites = editable ? await listPortalSites(company.id) : [];
  return { ...order, priority: details?.priority ?? "normal", sites };
});

export async function generateMetadata({ params }: PageProps<"/portal/orders/[id]">) {
  const order = await loadOrder((await params).id);
  return { title: `${order.number} · ${order.title}` };
}

export default async function PortalOrderPage({ params }: PageProps<"/portal/orders/[id]">) {
  const order = await loadOrder((await params).id);
  const place = order.site ? [order.site.name, order.address ?? order.site.address].filter(Boolean).join(" · ") : order.address;
  const visitAt = order.scheduledAt ?? order.arrivedAt ?? order.visits[0]?.startedAt;
  const showVisit = Boolean(visitAt) || !["done", "closed"].includes(order.status);
  const headingClass = "mb-3 font-heading text-[16px] font-bold";
  return (
    <div className="mx-auto max-w-2xl space-y-4 [overflow-wrap:anywhere]">
      <Link href="/portal" className="ln-link inline-flex min-h-[44px] items-center text-[13px]">← შეკვეთები</Link>
      <section className="ln-card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">{order.number}</span>
          <span className={cn("rounded-[6px] px-2 py-1 text-[12px] font-medium", order.triaged ? STATUS_COLORS[order.status] : STATUS_COLORS.closed)}>
            {order.triaged && order.status === "assigned" && !order.scheduledAt ? "ვიზიტის დრო ზუსტდება" : portalStatusLabel(order.status, order.triaged)}
          </span>
        </div>
        <h1 className="font-heading text-[20px] font-bold leading-snug">{order.title}</h1>
        {place && <p className="mt-2 text-[13px] text-[#4a5a6c] dark:text-[var(--ln-strong)]">{place}</p>}
        {order.status === "new" || order.status === "assigned"
          ? <PortalOrderEditDialog order={order} sites={order.sites} />
          : order.status !== "cancelled" && <p className="mt-3 text-[12px] text-muted-foreground">სამუშაო დაწყებულია — ცვლილებისთვის დაგვიკავშირდით</p>}
        <WorkflowProgress status={order.status} triaged={order.triaged} scheduled={Boolean(order.scheduledAt)} />
      </section>
      <section className="ln-card p-4">
        <h2 className={headingClass}>აღწერა</h2>
        <p className="whitespace-pre-wrap text-[13px] text-[#4a5a6c] dark:text-[var(--ln-strong)]">{order.description || "—"}</p>
      </section>
      <section className="ln-card p-4">
        <h2 className={headingClass}>თარიღები</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-muted-foreground">გაგზავნა</dt><dd>{formatDate(order.createdAt, true)}</dd>
          {showVisit && <><dt className="text-muted-foreground">ვიზიტი</dt><dd>{visitAt ? formatDate(visitAt, true) : "ჯერ არ არის"}</dd></>}
          <dt className="text-muted-foreground">შესრულება</dt><dd>{order.completedAt || order.closedAt ? formatDate(order.completedAt ?? order.closedAt, true) : "—"}</dd>
        </dl>
      </section>
      <section className="ln-card p-4">
        <h2 className={headingClass}>შესრულებული სამუშაოები</h2>
        {order.items.length ? <ul className="divide-y divide-border text-[13px]">
          {order.items.map((item) => <li key={item.id} className="py-2">{item.name} · {Number(item.quantity)} {item.unit}</li>)}
        </ul> : <p className="text-[13px] text-muted-foreground">ჯერ არ არის</p>}
      </section>
      {order.assignees.length > 0 && <section className="ln-card p-4">
        <h2 className={headingClass}>ტექნიკოსის შენიშვნა</h2>
        <ul className="space-y-3 text-[13px]">
          {order.assignees.map((assignee, index) => <li key={index}>
            <p className="font-medium">{assignee.user.name}{assignee.doneAt ? ` · ${formatDate(assignee.doneAt, true)}` : ""}</p>
            <p className="mt-1 whitespace-pre-wrap text-[#4a5a6c] dark:text-[var(--ln-strong)]">{assignee.doneNote}</p>
          </li>)}
        </ul>
      </section>}
      <section className="ln-card p-4">
        <h2 className={headingClass}>ფოტოანგარიში</h2>
        {order.attachments.length ? <PortalPhotoGallery photos={order.attachments} /> : <p className="text-[13px] text-muted-foreground">ფოტო ჯერ არ არის</p>}
      </section>
    </div>
  );
}
