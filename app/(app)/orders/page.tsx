import { LayoutGrid, List, Plus } from "lucide-react";
import Link from "next/link";
import { Kanban } from "@/components/app/kanban";
import { OrderFilters } from "@/components/app/order-filters";
import { OrderTable } from "@/components/app/order-table";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { OrderPriority, OrderStatus, OrderType, SystemType } from "@/db/schema";
import { orderPriorityEnum, orderStatusEnum, orderTypeEnum, systemTypeEnum } from "@/db/schema";
import { t } from "@/lib/i18n";
import { listAssignableUsers, listClientsWithSites, listOrders, type OrderFilters as Filters } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "შეკვეთები" };

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const view = str(sp.view) === "kanban" ? "kanban" : "list";
  const status = str(sp.status);
  const type = str(sp.type);
  const priority = str(sp.priority);
  const system = str(sp.system);

  const filters: Filters = {
    q: str(sp.q),
    status:
      status === "active" || status === "all" || (status && orderStatusEnum.enumValues.includes(status as OrderStatus))
        ? (status as Filters["status"])
        : view === "kanban"
          ? "all"
          : "active",
    type: type && orderTypeEnum.enumValues.includes(type as OrderType) ? (type as OrderType) : undefined,
    priority: priority && orderPriorityEnum.enumValues.includes(priority as OrderPriority) ? (priority as OrderPriority) : undefined,
    system: system && systemTypeEnum.enumValues.includes(system as SystemType) ? (system as SystemType) : undefined,
    assignee: str(sp.assignee) || undefined,
    clientId: str(sp.client) ? Number(str(sp.client)) : undefined,
    overdue: str(sp.overdue) === "1",
    inbox: false,
  };

  const [orders, users, clients] = await Promise.all([listOrders(filters, { limit: 300 }), listAssignableUsers(), listClientsWithSites()]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "view") qs.set(k, v);
  const listHref = `/orders?${qs.toString()}`;
  qs.set("view", "kanban");
  const kanbanHref = `/orders?${qs.toString()}`;

  return (
    <div>
      <PageHeader
        title={t.order.many}
        subtitle={`${orders.length} შეკვეთა`}
        actions={
          <>
            <div className="flex rounded-lg border bg-white p-0.5 dark:bg-neutral-900">
              <Link href={listHref} className={cn("rounded-md p-1.5", view === "list" ? "bg-sky-600 text-white" : "text-neutral-500 hover:bg-neutral-100")} title="სია">
                <List className="size-4" />
              </Link>
              <Link href={kanbanHref} className={cn("rounded-md p-1.5", view === "kanban" ? "bg-sky-600 text-white" : "text-neutral-500 hover:bg-neutral-100")} title="Kanban">
                <LayoutGrid className="size-4" />
              </Link>
            </div>
            <Button render={<Link href="/orders/new" />} className="bg-sky-600 hover:bg-sky-700">
              <Plus className="size-4" /> {t.order.new}
            </Button>
          </>
        }
      />

      <OrderFilters
        users={users}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        values={{
          q: filters.q ?? "",
          status: view === "kanban" ? "" : (filters.status ?? "active"),
          type: filters.type ?? "",
          priority: filters.priority ?? "",
          system: filters.system ?? "",
          assignee: filters.assignee ?? "",
          client: filters.clientId ? String(filters.clientId) : "",
          overdue: filters.overdue ? "1" : "",
          view,
        }}
      />

      <div className="mt-4">
        {view === "kanban" ? (
          <Kanban orders={orders} />
        ) : (
          <div className="rounded-xl border bg-white dark:bg-neutral-900">
            <OrderTable orders={orders} />
          </div>
        )}
      </div>
    </div>
  );
}
