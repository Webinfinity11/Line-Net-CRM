import { LayoutGrid, List, Plus } from "lucide-react";
import Link from "next/link";
import { Kanban } from "@/components/app/kanban";
import { OrderFilters } from "@/components/app/order-filters";
import { FilterChips } from "@/components/app/orders/filter-chips";
import { OrdersTable, type OrderRow } from "@/components/app/orders/orders-table";
import { StatusCards } from "@/components/app/orders/status-cards";
import { OrdersToolbar } from "@/components/app/orders/toolbar";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { OrderPriority, OrderStatus, OrderType, SystemType } from "@/db/schema";
import { orderPriorityEnum, orderStatusEnum, orderTypeEnum, systemTypeEnum } from "@/db/schema";
import { formatDate, t } from "@/lib/i18n";
import { isOverdue } from "@/lib/order-utils";
import {
  PAGE_SIZE,
  getStatusSummary,
  listAssignableUsers,
  listClientsWithSites,
  listOrders,
  listOrdersPage,
  plannedMinutesByUser,
  type OrderFilters as Filters,
  type OrderSort,
} from "@/lib/orders";
import { tbilisiTime, tbilisiToday } from "@/lib/schedule-utils";
import { requireUser } from "@/lib/session";
import { getWorkHoursPerDay } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "შეკვეთები" };

const SORTS = new Set(["created", "due", "priority", "amount"]);
const CARD_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "done"];

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

const dayIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const view = str(sp.view) === "kanban" ? "kanban" : "list";
  const status = str(sp.status);
  const type = str(sp.type);
  const priority = str(sp.priority);
  const system = str(sp.system);
  const sortParam = str(sp.sort);
  const sort = (SORTS.has(sortParam ?? "") ? sortParam : "created") as OrderSort;

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
    system: system || undefined,
    assignee: str(sp.assignee) || undefined,
    clientId: str(sp.client) ? Number(str(sp.client)) : undefined,
    overdue: str(sp.overdue) === "1",
    review: str(sp.review) === "1",
    inbox: false,
  };

  const page = Math.max(1, Number(str(sp.page)) || 1);
  const today = tbilisiToday();
  const [pageData, users, clients, summary, plannedToday, normHours] = await Promise.all([
    view === "kanban"
      ? listOrders(filters, { limit: 500 }).then((rows) => ({ rows, total: rows.length, page: 1, pages: 1, pageSize: rows.length }))
      : listOrdersPage(filters, page, PAGE_SIZE, sort),
    listAssignableUsers(),
    listClientsWithSites(),
    getStatusSummary(),
    plannedMinutesByUser(today),
    getWorkHoursPerDay(),
  ]);

  const executors = users
    .filter((u) => u.role === "executor")
    .map((u) => ({ id: u.id, name: u.name, image: u.image, specializations: u.specializations ?? [], hours: Math.round(((plannedToday[u.id] ?? 0) / 60) * 10) / 10 }));

  const rows: OrderRow[] = pageData.rows.map((o) => ({
    id: o.id,
    number: o.number,
    title: o.title,
    status: o.status,
    priority: o.priority,
    systemType: o.systemType,
    client: o.client?.name ?? null,
    site: o.site?.name ?? o.address ?? null,
    dueLabel: o.dueDate ? formatDate(o.dueDate) : null,
    overdue: isOverdue(o),
    assignees: o.assignees.map((a) => ({ id: a.user.id, name: a.user.name, image: a.user.image })),
    amount: o.amount,
    paymentStatus: o.paymentStatus,
    scheduledDate: o.scheduledAt ? dayIso(o.scheduledAt) : null,
    scheduledTime: o.scheduledAt ? tbilisiTime(o.scheduledAt) : null,
    plannedMinutes: o.plannedMinutes,
  }));

  // links keep every active param except the one being changed
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") params.set(k, v);
  const hrefWith = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    q.delete("page");
    const s = q.toString();
    return s ? `/orders?${s}` : "/orders";
  };
  const pageHref = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/orders?${s}` : "/orders";
  };
  const hiddenForSearch = Object.fromEntries([...params.entries()].filter(([k]) => k !== "q" && k !== "sort"));
  const activeCount = ["q", "type", "system", "priority", "assignee", "client", "overdue"].filter((k) => params.get(k)).length;

  return (
    <div className="space-y-4">
      <div className="max-md:[&>div]:gap-2 max-md:[&>div]:flex-nowrap max-md:[&_h1]:text-[20px]">
      <PageHeader
        title={t.order.many}
        subtitle={`სულ ${pageData.total} შეკვეთა`}
        actions={
          <>
            <div className="flex rounded-lg border border-[#e6ebf2] bg-white p-0.5">
              <Link
                href={hrefWith({ view: null })}
                className={cn("rounded-md p-1.5 max-md:size-11 max-md:grid max-md:place-items-center", view === "list" ? "bg-[#3457d5] text-white" : "text-muted-foreground hover:bg-[#f8faff]")}
                title="სია"
              >
                <List className="size-4" />
              </Link>
              <Link
                href={hrefWith({ view: "kanban" })}
                className={cn("rounded-md p-1.5 max-md:size-11 max-md:grid max-md:place-items-center", view === "kanban" ? "bg-[#3457d5] text-white" : "text-muted-foreground hover:bg-[#f8faff]")}
                title="Kanban"
              >
                <LayoutGrid className="size-4" />
              </Link>
            </div>
            <Button aria-label={t.order.new} className="max-md:size-11 max-md:p-0" render={<Link href="/orders/new" />}>
              <Plus className="size-4" /> <span className="max-md:hidden">{t.order.new}</span>
            </Button>
          </>
        }
      />

      </div>
      <StatusCards counts={summary.counts} flow={summary.flow} activeStatus={CARD_STATUSES.includes(status as OrderStatus) ? status : undefined} hrefFor={(s) => hrefWith({ status: s, view: null })} />

      <OrdersToolbar
        q={filters.q ?? ""}
        sort={sort}
        total={pageData.total}
        hidden={hiddenForSearch}
        activeCount={activeCount}
        excelHref="/api/export?type=orders&all=1"
      >
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
            sort,
          }}
        />
      </OrdersToolbar>

      <FilterChips sp={sp} users={users} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />

      {view === "kanban" ? (
        <Kanban orders={pageData.rows} />
      ) : (
        <OrdersTable
          rows={rows}
          executors={executors}
          normHours={normHours}
          today={today}
          page={pageData.page}
          pages={pageData.pages}
          prevHref={pageData.page > 1 ? pageHref(pageData.page - 1) : null}
          nextHref={pageData.page < pageData.pages ? pageHref(pageData.page + 1) : null}
        />
      )}
    </div>
  );
}
