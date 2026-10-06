import { Building2, Mail, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { setStatus, updateOrder } from "@/actions/orders";
import { ConfirmButton } from "@/components/app/confirm-button";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, t } from "@/lib/i18n";
import { getOrder, listAssignableUsers, listClientsWithSites } from "@/lib/orders";
import { toMtavruli } from "@/lib/mtavruli";
import { requireUser } from "@/lib/session";

export const metadata = { title: "რედაქტირება" };

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  await requireUser(["admin", "manager"]);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const [order, clients] = await Promise.all([getOrder(orderId), listClientsWithSites()]);
  if (!order) notFound();
  const users = await listAssignableUsers(order.assignees.map(a => a.userId));

  const triage = !order.triaged;
  // a request from the client portal has no letter behind it: name it for what it is
  const fromPortal = order.source === "portal";
  const action = updateOrder.bind(null, order.id);
  const form = (
    <OrderForm
      clients={clients}
      users={users}
      compact={triage}
      amountFromItems={order.items.length > 0}
      initial={{
        title: order.title,
        description: order.description,
        type: order.type,
        priority: order.priority,
        clientId: order.clientId,
        siteId: order.siteId,
        address: order.address,
        dueDate: order.dueDate,
        amount: order.amount,
        systemType: order.systemType,
        plannedMinutes: order.plannedMinutes,
        scheduledAt: order.scheduledAt,
        warrantyMonths: order.warrantyMonths,
        assigneeIds: order.assignees.map((a) => a.userId),
      }}
      action={action}
      submitLabel={triage ? "დამუშავება" : t.common.save}
      cancelHref={`/orders/${order.id}`}
    />
  );

  if (!triage) {
    return (
      <div>
        <PageHeader kicker={order.number} title={t.common.edit} subtitle={order.title} />
        {form}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        kicker={order.number}
        title={fromPortal ? "მოთხოვნის დამუშავება" : "წერილის დამუშავება"}
        subtitle="აირჩიეთ კლიენტი, ობიექტი და შემსრულებელი. შეავსეთ შეკვეთის დეტალები."
        actions={
          <ConfirmButton
            title={fromPortal ? "მოთხოვნის გაუქმება" : "წერილის გაუქმება"}
            description="შეკვეთა გადავა „გაუქმებული“ სტატუსში და შემოსულებში აღარ გამოჩნდება."
            confirmLabel={fromPortal ? "მოთხოვნის გაუქმება" : "შეკვეთის გაუქმება"}
            variant="outline"
            size="sm"
            action={setStatus.bind(null, order.id, "cancelled")}
          >
            <XCircle className="size-3.5" /> არ არის შეკვეთა
          </ConfirmButton>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,3fr)_minmax(0,9fr)]">
        <aside className="ln-card h-fit p-5 xl:sticky xl:top-[84px]" aria-label={fromPortal ? "კაბინეტიდან შემოსული" : "შემოსული წერილი"}>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-[15px]">
            {fromPortal ? <Building2 className="size-4 text-muted-foreground [stroke-width:1.7]" /> : <Mail className="size-4 text-muted-foreground [stroke-width:1.7]" />}
            {toMtavruli(fromPortal ? "კაბინეტიდან შემოსული" : "შემოსული წერილი")}
          </h2>
          <dl className="space-y-2 text-[12.5px]">
            <div>
              <dt className="text-[11px] text-muted-foreground">{fromPortal ? "კომპანია" : "გამომგზავნი"}</dt>
              <dd className="break-all">{(fromPortal ? order.client?.name : order.emailFrom) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">{fromPortal ? "გამოგზავნილია" : "თემა"}</dt>
              <dd>{fromPortal ? formatDate(order.createdAt, true) : (order.emailSubject ?? "—")}</dd>
            </div>
          </dl>
          {order.description && (
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-[#f6fafb] dark:bg-muted p-3 font-sans text-[12.5px] leading-relaxed text-[#4a5e73] dark:text-[var(--ln-strong)]">{order.description}</pre>
          )}
        </aside>
        <div className="min-w-0">{form}</div>
      </div>
    </div>
  );
}
