import { Mail, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { setStatus, updateOrder } from "@/actions/orders";
import { ConfirmButton } from "@/components/app/confirm-button";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader } from "@/components/app/page-header";
import { t } from "@/lib/i18n";
import { getOrder, listAssignableUsers, listClientsWithSites } from "@/lib/orders";
import { toMtavruli } from "@/lib/mtavruli";
import { requireUser } from "@/lib/session";

export const metadata = { title: "რედაქტირება" };

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  await requireUser(["admin", "manager"]);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const [order, clients, users] = await Promise.all([getOrder(orderId), listClientsWithSites(), listAssignableUsers()]);
  if (!order) notFound();

  const triage = !order.triaged;
  const action = updateOrder.bind(null, order.id);
  const form = (
    <OrderForm
      clients={clients}
      users={users}
      compact={triage}
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
        requiresPhoto: order.requiresPhoto,
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
        title="წერილის დამუშავება"
        subtitle="შეავსეთ კლიენტი, ობიექტი და შემსრულებელი. დანარჩენი ველები დამატებით პარამეტრებშია."
        actions={
          <ConfirmButton
            title="წერილის გაუქმება"
            description="შეკვეთა გადავა „გაუქმებული“ სტატუსში და შემოსულებიდან წაიშლება."
            confirmLabel="გაუქმება"
            variant="outline"
            size="sm"
            action={setStatus.bind(null, order.id, "cancelled")}
          >
            <XCircle className="size-3.5" /> არ არის შეკვეთა
          </ConfirmButton>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,3fr)_minmax(0,9fr)]">
        <aside className="ln-card h-fit p-5 xl:sticky xl:top-[84px]" aria-label="შემოსული წერილი">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-[15px]">
            <Mail className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli("შემოსული წერილი")}
          </h2>
          <dl className="space-y-2 text-[12.5px]">
            <div>
              <dt className="text-[11px] text-muted-foreground">გამომგზავნი</dt>
              <dd className="break-all">{order.emailFrom ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">თემა</dt>
              <dd>{order.emailSubject ?? "—"}</dd>
            </div>
          </dl>
          {order.description && (
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-[#f8faff] p-3 font-sans text-[12.5px] leading-relaxed text-[#4a5e73]">{order.description}</pre>
          )}
        </aside>
        <div className="min-w-0">{form}</div>
      </div>
    </div>
  );
}
