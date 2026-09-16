import { notFound } from "next/navigation";
import { updateOrder } from "@/actions/orders";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader } from "@/components/app/page-header";
import { t } from "@/lib/i18n";
import { getOrder, listAssignableUsers, listClientsWithSites } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata = { title: "რედაქტირება" };

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  await requireUser(["admin", "manager"]);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const [order, clients, users] = await Promise.all([getOrder(orderId), listClientsWithSites(), listAssignableUsers()]);
  if (!order) notFound();

  const action = updateOrder.bind(null, order.id);

  return (
    <div>
      <PageHeader
        title={`${order.number} · ${t.common.edit}`}
        subtitle={!order.triaged ? "შემოსული წერილი: შეავსეთ კლიენტი, ობიექტი და დანიშნეთ შემსრულებელი" : order.title}
      />
      {!order.triaged && order.description && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
          <div className="mb-1 text-xs font-medium text-blue-700 dark:text-blue-300">
            წერილი: {order.emailFrom} · {order.emailSubject}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-neutral-700 dark:text-neutral-300">{order.description}</pre>
        </div>
      )}
      <OrderForm
        clients={clients}
        users={users}
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
        submitLabel={t.common.save}
        cancelHref={`/orders/${order.id}`}
      />
    </div>
  );
}
