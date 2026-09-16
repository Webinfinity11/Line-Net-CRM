import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, ne, notInArray, or, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  orderAssignees,
  orders,
  sites,
  user,
  type OrderPriority,
  type OrderStatus,
  type OrderType,
  type SystemType,
} from "@/db/schema";
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
  inbox?: boolean;
  /** Only orders assigned to this user id */
  mine?: string;
  range?: DateRange;
};

export type DateRange = "today" | "week" | "month" | "all";

export function rangeStart(range: DateRange): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(d.getDate() - 29);
  return d;
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
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

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

export async function getDashboardStats(range: DateRange = "week") {
  const start = rangeStart(range);
  const rangeWhere = start ? gte(orders.createdAt, start) : undefined;
  const notInbox = eq(orders.triaged, true);

  const [byStatusRows, createdRow, completedRow, overdueList, loadRows, users, paidRow, unpaidRow, recent, inbox, todayList, weekly, warranty, mapPoints] =
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
      listOrders({ overdue: true, inbox: false }, { limit: 20 }),
      db
        .select({ userId: orderAssignees.userId, active: count() })
        .from(orderAssignees)
        .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
        .where(inArray(orders.status, ACTIVE_STATUSES))
        .groupBy(orderAssignees.userId),
      listAssignableUsers(),
      db
        .select({ total: sum(orders.amount) })
        .from(orders)
        .where(and(notInbox, eq(orders.paymentStatus, "paid"), start ? gte(orders.paidAt, start) : undefined)),
      db
        .select({ total: sum(orders.amount) })
        .from(orders)
        .where(and(notInbox, ne(orders.paymentStatus, "paid"), ne(orders.status, "cancelled"))),
      listOrders({ inbox: false }, { limit: 8 }),
      listOrders({ inbox: true }, { limit: 5 }),
      db.query.orders.findMany({
        where: and(notInbox, eq(orders.dueDate, todayIso()), notInArray(orders.status, FINISHED)),
        with: { client: { columns: { id: true, name: true } }, assignees: { with: { user: { columns: { id: true, name: true } } } } },
        orderBy: [asc(orders.priority), asc(orders.createdAt)],
        limit: 10,
      }),
      getWeeklySeries(),
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
    warranty,
    mapPoints: mapPoints.map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) })),
  };
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

