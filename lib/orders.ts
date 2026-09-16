import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, ne, notInArray, or, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  orderAssignees,
  orderPayments,
  orders,
  sites,
  user,
  type OrderPriority,
  type OrderStatus,
  type OrderType,
  type SystemType,
} from "@/db/schema";
import type { SessionUser } from "@/lib/session";
import { tbilisiDayBounds, tbilisiToday } from "@/lib/schedule-utils";
import "server-only";
import { ACTIVE_STATUSES } from "@/lib/i18n";
import { FINISHED_STATUSES, isOverdue, todayIso } from "@/lib/order-utils";

export { isOverdue, todayIso };

export type OrderFilters = {
  q?: string;
  status?: OrderStatus | "active" | "all";
  type?: OrderType;
  priority?: OrderPriority;
  system?: SystemType;
  assignee?: string;
  clientId?: number;
  overdue?: boolean;
  /** orders whose migrated partial payment needs manual confirmation */
  review?: boolean;
  inbox?: boolean;
  /** Only orders assigned to this user id */
  mine?: string;
  range?: DateRange;
};

export type DateRange = "today" | "week" | "month" | "all";

/** Start of the range in Asia/Tbilisi (server may run in UTC). */
export function rangeStart(range: DateRange): Date | null {
  if (range === "all") return null;
  const { start } = tbilisiDayBounds(tbilisiToday());
  const days = range === "today" ? 0 : range === "week" ? 6 : 29;
  return new Date(start.getTime() - days * 24 * 60 * 60_000);
}

const FINISHED = FINISHED_STATUSES;

function buildWhere(f: OrderFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.inbox) {
    parts.push(eq(orders.triaged, false));
  } else if (f.inbox === false) {
    parts.push(eq(orders.triaged, true));
  }
  if (f.status && f.status !== "all") {
    if (f.status === "active") parts.push(inArray(orders.status, ACTIVE_STATUSES));
    else parts.push(eq(orders.status, f.status));
  }
  if (f.type) parts.push(eq(orders.type, f.type));
  if (f.priority) parts.push(eq(orders.priority, f.priority));
  if (f.system) parts.push(eq(orders.systemType, f.system));
  if (f.clientId) parts.push(eq(orders.clientId, f.clientId));
  if (f.overdue) {
    parts.push(lt(orders.dueDate, todayIso()));
    parts.push(notInArray(orders.status, FINISHED));
  }
  if (f.review) parts.push(eq(orders.paymentReviewNeeded, true));
  if (f.q && f.q.trim()) {
    const q = `%${f.q.trim()}%`;
    parts.push(
      or(
        ilike(orders.title, q),
        ilike(orders.number, q),
        ilike(orders.description, q),
        ilike(orders.address, q),
        ilike(orders.emailFrom, q),
      )!,
    );
  }
  const assignee = f.mine ?? f.assignee;
  if (assignee) {
    // Raw identifiers on purpose: inside relational-query `where`, drizzle re-aliases
    // other tables' columns to the outer table alias and produces "orders"."order_id".
    parts.push(sql`exists (select 1 from order_assignees oa where oa.order_id = ${orders.id} and oa.user_id = ${assignee})`);
  }
  const start = f.range ? rangeStart(f.range) : null;
  if (start) parts.push(gte(orders.createdAt, start));
  return parts.length ? and(...parts) : undefined;
}

export async function listOrders(f: OrderFilters = {}, opts: { limit?: number; offset?: number } = {}) {
  return db.query.orders.findMany({
    where: buildWhere(f),
    with: {
      client: { columns: { id: true, name: true } },
      site: { columns: { id: true, name: true, address: true } },
      assignees: { with: { user: { columns: { id: true, name: true, image: true } } } },
    },
    orderBy: [desc(orders.createdAt)],
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
  });
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>[number];

export const PAGE_SIZE = 50;

/** Page of orders plus the total count for the same filters. */
export async function listOrdersPage(f: OrderFilters, page: number, pageSize = PAGE_SIZE) {
  const safePage = Math.max(1, Math.floor(page || 1));
  const [rows, total] = await Promise.all([listOrders(f, { limit: pageSize, offset: (safePage - 1) * pageSize }), countOrders(f)]);
  return { rows, total, page: safePage, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Orders for the executor's own list. Financial columns are never selected,
 * so nothing money-related reaches the client bundle.
 */
export async function listMyOrders(userId: string) {
  return db.query.orders.findMany({
    where: and(
      eq(orders.triaged, true),
      sql`exists (select 1 from order_assignees oa where oa.order_id = ${orders.id} and oa.user_id = ${userId})`,
    ),
    columns: {
      id: true,
      number: true,
      title: true,
      status: true,
      type: true,
      priority: true,
      systemType: true,
      address: true,
      dueDate: true,
      scheduledAt: true,
      plannedMinutes: true,
      requiresPhoto: true,
      createdAt: true,
    },
    with: {
      client: { columns: { id: true, name: true, phone: true } },
      site: { columns: { id: true, name: true, address: true, lat: true, lng: true } },
      assignees: { columns: { userId: true, seenAt: true } },
      visits: { columns: { id: true, userId: true, startedAt: true, endedAt: true } },
      checklist: { columns: { id: true, done: true, required: true } },
    },
    orderBy: [asc(orders.scheduledAt), desc(orders.createdAt)],
    limit: 300,
  });
}

export type MyOrderItem = Awaited<ReturnType<typeof listMyOrders>>[number];

export async function countOrders(f: OrderFilters = {}) {
  const [row] = await db.select({ n: count() }).from(orders).where(buildWhere(f));
  return row?.n ?? 0;
}

export async function getOrder(id: number) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      client: true,
      site: true,
      creator: { columns: { id: true, name: true } },
      assignees: { with: { user: { columns: { id: true, name: true, image: true, phone: true, role: true } } } },
      comments: { with: { user: { columns: { id: true, name: true, image: true } } }, orderBy: [asc(sql`created_at`)] },
      attachments: { orderBy: [asc(sql`created_at`)] },
      events: { with: { user: { columns: { id: true, name: true } } }, orderBy: [desc(sql`created_at`)] },
      materials: { orderBy: [asc(sql`created_at`)] },
      checklist: { with: { doneByUser: { columns: { id: true, name: true } } }, orderBy: [asc(sql`position`), asc(sql`id`)] },
      payments: { with: { creator: { columns: { id: true, name: true } } }, orderBy: [desc(sql`paid_at`), desc(sql`id`)] },
      visits: { with: { user: { columns: { id: true, name: true, image: true } } }, orderBy: [desc(sql`started_at`)] },
      verifier: { columns: { id: true, name: true } },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/**
 * Role-restricted order view. Executors get the order only when assigned, and the
 * financial fields are stripped on the server: amount, payments, paid totals and
 * material prices never leave the server for them.
 */
export async function getOrderForUser(id: number, u: SessionUser): Promise<{ order: OrderDetail; financeVisible: boolean } | null> {
  const order = await getOrder(id);
  if (!order) return null;
  const staff = u.role === "admin" || u.role === "manager";
  if (staff) return { order, financeVisible: true };
  if (!order.assignees.some((a) => a.userId === u.id)) return null;
  const stripped: OrderDetail = {
    ...order,
    amount: null,
    paidTotal: "0",
    paidAt: null,
    paymentReviewNeeded: false,
    payments: [],
    materials: order.materials.map((m) => ({ ...m, unitCost: null })),
    events: order.events.filter((e) => !e.type.startsWith("payment")),
  };
  return { order: stripped, financeVisible: false };
}

export async function getInboxCount() {
  const [row] = await db.select({ n: count() }).from(orders).where(eq(orders.triaged, false));
  return row?.n ?? 0;
}

export async function listAssignableUsers() {
  return db
    .select({ id: user.id, name: user.name, role: user.role, image: user.image, phone: user.phone, specializations: user.specializations })
    .from(user)
    .where(and(inArray(user.role, ["executor", "manager", "admin"]), eq(user.banned, false)))
    .orderBy(asc(user.name));
}

export async function listAllUsers() {
  return db.select().from(user).orderBy(asc(user.role), asc(user.name));
}

export async function listClientsWithSites() {
  return db.query.clients.findMany({
    with: { sites: { orderBy: [asc(sites.name)] } },
    orderBy: [asc(clients.name)],
  });
}

export async function getClient(id: number) {
  return db.query.clients.findFirst({
    where: eq(clients.id, id),
    with: { sites: { orderBy: [asc(sites.name)], with: { equipment: { orderBy: [asc(sql`name`)] } } } },
  });
}

/** Unseen assignments for the executor badge */
export async function getUnseenAssignmentCount(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(orderAssignees)
    .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
    .where(and(eq(orderAssignees.userId, userId), isNull(orderAssignees.seenAt), notInArray(orders.status, FINISHED)));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function previousRange(range: DateRange): { start: Date; end: Date } | null {
  const start = rangeStart(range);
  if (!start) return null;
  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start: prevStart, end: start };
}

export async function getDashboardStats(range: DateRange = "week") {
  const start = rangeStart(range);
  const prev = previousRange(range);
  const rangeWhere = start ? gte(orders.createdAt, start) : undefined;
  const notInbox = eq(orders.triaged, true);

  const today = tbilisiDayBounds(tbilisiToday());
  const [byStatusRows, createdRow, completedRow, overdueList, loadRows, users, paidRow, unpaidRow, recent, inbox, todayList, weekly, prevRow, warranty, mapPoints, overdueCountRow, urgentUnassigned, awaitingClosure, reviewRow, board, plannedTodayRows, activeTotalRow, awaitingClosureRow, todayTotalRow] =
    await Promise.all([
      db
        .select({ status: orders.status, n: count() })
        .from(orders)
        .where(and(notInbox, rangeWhere))
        .groupBy(orders.status),
      db.select({ n: count() }).from(orders).where(and(notInbox, rangeWhere)),
      db
        .select({ n: count() })
        .from(orders)
        .where(and(notInbox, inArray(orders.status, ["done", "closed"]), start ? gte(orders.completedAt, start) : undefined)),
      listOrders({ overdue: true, inbox: false }, { limit: 10 }),
      db
        .select({ userId: orderAssignees.userId, active: count() })
        .from(orderAssignees)
        .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
        .where(inArray(orders.status, ACTIVE_STATUSES))
        .groupBy(orderAssignees.userId),
      listAssignableUsers(),
      // received in the selected period, from actual payment rows
      db
        .select({ total: sum(orderPayments.amount) })
        .from(orderPayments)
        .where(start ? gte(orderPayments.paidAt, start) : undefined),
      // outstanding balance, all time: amount minus what was received, excluding cancelled orders
      db
        .select({ total: sql<string>`coalesce(sum(greatest(${orders.amount} - ${orders.paidTotal}, 0)), 0)` })
        .from(orders)
        .where(and(notInbox, ne(orders.status, "cancelled"), sql`${orders.amount} is not null`)),
      listOrders({ inbox: false }, { limit: 8 }),
      listOrders({ inbox: true }, { limit: 5 }),
      // today's planned visits (scheduled time inside the Tbilisi day)
      db.query.orders.findMany({
        where: and(notInbox, gte(orders.scheduledAt, today.start), lt(orders.scheduledAt, today.end), ne(orders.status, "cancelled")),
        with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true } } } } },
        orderBy: [asc(orders.scheduledAt)],
        limit: 12,
      }),
      getWeeklySeries(),
      prev
        ? db
            .select({
              created: sql<number>`count(*)`.mapWith(Number),
              completed: sql<number>`count(*) filter (where ${orders.completedAt} >= ${prev.start} and ${orders.completedAt} < ${prev.end})`.mapWith(Number),
            })
            .from(orders)
            .where(and(notInbox, gte(orders.createdAt, prev.start), lt(orders.createdAt, prev.end)))
        : Promise.resolve([{ created: 0, completed: 0 }]),
      db.query.orders.findMany({
        where: and(notInbox, sql`${orders.warrantyUntil} between current_date and current_date + 30`),
        columns: { id: true, number: true, title: true, warrantyUntil: true },
        with: { client: { columns: { id: true, name: true } } },
        orderBy: [asc(orders.warrantyUntil)],
        limit: 10,
      }),
      db
        .select({
          id: orders.id,
          number: orders.number,
          title: orders.title,
          status: orders.status,
          lat: sites.lat,
          lng: sites.lng,
          siteName: sites.name,
          clientName: clients.name,
        })
        .from(orders)
        .innerJoin(sites, eq(sites.id, orders.siteId))
        .leftJoin(clients, eq(clients.id, orders.clientId))
        .where(and(notInbox, inArray(orders.status, ACTIVE_STATUSES), sql`${sites.lat} is not null`))
        .limit(200),
      db
        .select({ n: count() })
        .from(orders)
        .where(and(notInbox, lt(orders.dueDate, todayIso()), notInArray(orders.status, FINISHED))),
      db.query.orders.findMany({
        where: and(notInbox, eq(orders.status, "new"), inArray(orders.priority, ["urgent", "high"])),
        columns: { id: true, number: true, title: true, priority: true, dueDate: true, scheduledAt: true },
        with: { client: { columns: { id: true, name: true } } },
        orderBy: [asc(orders.priority), asc(orders.createdAt)],
        limit: 8,
      }),
      db.query.orders.findMany({
        where: and(notInbox, eq(orders.status, "done")),
        columns: { id: true, number: true, title: true, completedAt: true },
        with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true } } } } },
        orderBy: [asc(orders.completedAt)],
        limit: 8,
      }),
      db.select({ n: count() }).from(orders).where(and(notInbox, eq(orders.paymentReviewNeeded, true))),
      // dashboard work board: current active work plus finished work awaiting closure
      db.query.orders.findMany({
        where: and(notInbox, inArray(orders.status, ["new", "assigned", "in_progress", "done"])),
        columns: { id: true, number: true, title: true, status: true, priority: true, type: true, systemType: true, dueDate: true, scheduledAt: true, plannedMinutes: true, description: true },
        with: {
          client: { columns: { id: true, name: true } },
          site: { columns: { id: true, name: true, address: true } },
          assignees: { with: { user: { columns: { id: true, name: true, image: true } } } },
        },
        orderBy: [desc(orders.updatedAt)],
        limit: 30,
      }),
      // planned minutes per executor for today's scheduled visits (planned time, not tracked time)
      db
        .select({ userId: orderAssignees.userId, minutes: sql<number>`coalesce(sum(coalesce(${orders.plannedMinutes}, 120)), 0)`.mapWith(Number) })
        .from(orderAssignees)
        .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
        .where(and(notInbox, gte(orders.scheduledAt, today.start), lt(orders.scheduledAt, today.end), ne(orders.status, "cancelled")))
        .groupBy(orderAssignees.userId),
      db.select({ n: count() }).from(orders).where(and(notInbox, inArray(orders.status, ACTIVE_STATUSES))),
      db.select({ n: count() }).from(orders).where(and(notInbox, eq(orders.status, "done"))),
      db.select({ n: count() }).from(orders).where(and(notInbox, gte(orders.scheduledAt, today.start), lt(orders.scheduledAt, today.end), ne(orders.status, "cancelled"))),
    ]);

  const counts = Object.fromEntries(byStatusRows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>;
  const loadMap = new Map(loadRows.map((r) => [r.userId, r.active]));
  const executorLoad = users
    .filter((u) => u.role === "executor" || loadMap.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, image: u.image, active: loadMap.get(u.id) ?? 0 }))
    .sort((a, b) => b.active - a.active);
  const maxLoad = Math.max(1, ...executorLoad.map((e) => e.active));

  return {
    range,
    counts,
    created: createdRow[0]?.n ?? 0,
    completed: completedRow[0]?.n ?? 0,
    overdue: overdueList,
    overdueCount: overdueCountRow[0]?.n ?? 0,
    urgentUnassigned,
    awaitingClosure,
    paymentReviewCount: reviewRow[0]?.n ?? 0,
    executorLoad,
    maxLoad,
    money: {
      paid: Number(paidRow[0]?.total ?? 0),
      unpaid: Number(unpaidRow[0]?.total ?? 0),
    },
    recent,
    inbox,
    today: todayList,
    weekly,
    previous: { created: prevRow[0]?.created ?? 0, completed: prevRow[0]?.completed ?? 0 },
    warranty,
    mapPoints: mapPoints.map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) })),
    board,
    plannedToday: Object.fromEntries(plannedTodayRows.map((r) => [r.userId, r.minutes])) as Record<string, number>,
    activeTotal: activeTotalRow[0]?.n ?? 0,
    awaitingClosureCount: awaitingClosureRow[0]?.n ?? 0,
    todayTotal: todayTotalRow[0]?.n ?? 0,
  };
}

/** Planned minutes per executor for one Tbilisi day (planned time, not tracked time). */
export async function plannedMinutesByUser(dayIso: string): Promise<Record<string, number>> {
  const { start, end } = tbilisiDayBounds(dayIso);
  const rows = await db
    .select({ userId: orderAssignees.userId, minutes: sql<number>`coalesce(sum(coalesce(${orders.plannedMinutes}, 120)), 0)`.mapWith(Number) })
    .from(orderAssignees)
    .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
    .where(and(eq(orders.triaged, true), gte(orders.scheduledAt, start), lt(orders.scheduledAt, end), ne(orders.status, "cancelled")))
    .groupBy(orderAssignees.userId);
  return Object.fromEntries(rows.map((r) => [r.userId, r.minutes]));
}

async function getWeeklySeries() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const dayExpr = (col: SQL) => sql<string>`to_char(${col} at time zone 'Asia/Tbilisi', 'YYYY-MM-DD')`;
  const [createdRows, completedRows] = await Promise.all([
    db
      .select({ day: dayExpr(sql`${orders.createdAt}`), n: count() })
      .from(orders)
      .where(and(eq(orders.triaged, true), gte(orders.createdAt, start)))
      .groupBy(sql`1`),
    db
      .select({ day: dayExpr(sql`${orders.completedAt}`), n: count() })
      .from(orders)
      .where(and(eq(orders.triaged, true), gte(orders.completedAt, start)))
      .groupBy(sql`1`),
  ]);
  const created = new Map(createdRows.map((r) => [r.day, r.n]));
  const completed = new Map(completedRows.map((r) => [r.day, r.n]));
  const days: { day: string; label: string; created: number; completed: number }[] = [];
  const names = ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const tz = d.getTimezoneOffset() * 60000;
    const key = new Date(d.getTime() - tz).toISOString().slice(0, 10);
    days.push({ day: key, label: `${names[d.getDay()]} ${d.getDate()}`, created: created.get(key) ?? 0, completed: completed.get(key) ?? 0 });
  }
  return days;
}

