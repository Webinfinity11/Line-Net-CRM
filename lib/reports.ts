import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, orderAssignees, orderMaterials, orderPayments, orders, user } from "@/db/schema";
import { tbilisiDayBounds, tbilisiToday } from "@/lib/schedule-utils";

export type Period = { from: string; to: string }; // both days inclusive, Tbilisi calendar (YYYY-MM-DD)

/** The current Tbilisi month, first to last day. */
export function defaultPeriod(now = new Date()): Period {
  const today = tbilisiToday(now);
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** Half-open instants: Tbilisi midnight of `from` up to the midnight after `to`. */
export function periodRange(p: Period) {
  return { start: tbilisiDayBounds(p.from).start, end: tbilisiDayBounds(p.to).end };
}

const range = periodRange;

const num = (v: unknown) => Number(v ?? 0);

export async function reportByClient(p: Period) {
  const { start, end } = range(p);
  const rows = await db
    .select({
      clientId: clients.id,
      client: clients.name,
      total: sql<number>`count(${orders.id})`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${orders.status} in ('done','closed'))`.mapWith(Number),
      amount: sql<string>`coalesce(sum(${orders.amount}), 0)`,
      paid: sql<string>`coalesce(sum(${orders.paidTotal}), 0)`,
      unpaid: sql<string>`coalesce(sum(greatest(${orders.amount} - ${orders.paidTotal}, 0)) filter (where ${orders.status} <> 'cancelled'), 0)`,
    })
    .from(orders)
    .innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(eq(orders.triaged, true), ne(orders.status, "cancelled"), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(clients.id, clients.name)
    .orderBy(desc(sql`sum(${orders.amount})`));
  return rows.map((r) => ({ ...r, amount: num(r.amount), paid: num(r.paid), unpaid: num(r.unpaid) }));
}

export async function reportByExecutor(p: Period) {
  const { start, end } = range(p);
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      total: sql<number>`count(${orders.id})`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${orders.status} in ('done','closed'))`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${orders.dueDate} < ${tbilisiToday()}::date and ${orders.status} not in ('done','closed','cancelled'))`.mapWith(Number),
      lateDone: sql<number>`count(*) filter (where ${orders.completedAt} is not null and ${orders.dueDate} is not null and (${orders.completedAt} at time zone 'Asia/Tbilisi')::date > ${orders.dueDate})`.mapWith(Number),
      minutes: sql<number>`coalesce(sum((select sum(extract(epoch from (v.ended_at - v.started_at)) / 60) from order_visits v where v.user_id = ${orderAssignees.userId} and v.order_id = ${orderAssignees.orderId} and v.ended_at is not null)), 0)`.mapWith(Number),
      amount: sql<string>`coalesce(sum(${orders.amount}), 0)`,
    })
    .from(orderAssignees)
    .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
    .innerJoin(user, eq(user.id, orderAssignees.userId))
    .where(and(eq(orders.triaged, true), ne(orders.status, "cancelled"), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(user.id, user.name)
    .orderBy(desc(sql`count(*) filter (where ${orders.status} in ('done','closed'))`));
  return rows.map((r) => ({ ...r, amount: num(r.amount), hours: Math.round((r.minutes / 60) * 10) / 10 }));
}

export async function reportBySystem(p: Period) {
  const { start, end } = range(p);
  const rows = await db
    .select({
      system: orders.systemType,
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${orders.status} in ('done','closed'))`.mapWith(Number),
      amount: sql<string>`coalesce(sum(${orders.amount}), 0)`,
      paid: sql<string>`coalesce(sum(${orders.paidTotal}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.triaged, true), ne(orders.status, "cancelled"), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .groupBy(orders.systemType)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({ ...r, amount: num(r.amount), paid: num(r.paid) }));
}

export async function reportMonthly(months = 12) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const monthExpr = (col: ReturnType<typeof sql>) => sql<string>`to_char(${col} at time zone 'Asia/Tbilisi', 'YYYY-MM')`;

  const [created, completed, revenue, cost] = await Promise.all([
    db
      .select({ m: monthExpr(sql`${orders.createdAt}`), n: sql<number>`count(*)`.mapWith(Number), amount: sql<string>`coalesce(sum(${orders.amount}),0)` })
      .from(orders)
      .where(and(eq(orders.triaged, true), ne(orders.status, "cancelled"), gte(orders.createdAt, start)))
      .groupBy(sql`1`),
    db
      .select({ m: monthExpr(sql`${orders.completedAt}`), n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.triaged, true), isNotNull(orders.completedAt), gte(orders.completedAt, start)))
      .groupBy(sql`1`),
    db
      .select({ m: monthExpr(sql`${orderPayments.paidAt}`), amount: sql<string>`coalesce(sum(${orderPayments.amount}),0)` })
      .from(orderPayments)
      .where(gte(orderPayments.paidAt, start))
      .groupBy(sql`1`),
    db
      .select({ m: monthExpr(sql`${orders.createdAt}`), cost: sql<string>`coalesce(sum(${orderMaterials.quantity} * ${orderMaterials.unitCost}),0)` })
      .from(orderMaterials)
      .innerJoin(orders, eq(orders.id, orderMaterials.orderId))
      .where(gte(orders.createdAt, start))
      .groupBy(sql`1`),
  ]);
  const cMap = new Map(created.map((r) => [r.m, r]));
  const dMap = new Map(completed.map((r) => [r.m, r.n]));
  const rMap = new Map(revenue.map((r) => [r.m, num(r.amount)]));
  const kMap = new Map(cost.map((r) => [r.m, num(r.cost)]));
  const out: { month: string; created: number; completed: number; booked: number; revenue: number; cost: number; profit: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + i);
    const key = d.toISOString().slice(0, 7);
    const c = cMap.get(key);
    const revenueM = rMap.get(key) ?? 0;
    const costM = kMap.get(key) ?? 0;
    out.push({ month: key, created: c?.n ?? 0, completed: dMap.get(key) ?? 0, booked: num(c?.amount), revenue: revenueM, cost: costM, profit: revenueM - costM });
  }
  const [outstanding] = await db
    .select({ unpaid: sql<string>`coalesce(sum(greatest(${orders.amount} - ${orders.paidTotal}, 0)) filter (where ${orders.status} <> 'cancelled'), 0)` })
    .from(orders)
    .where(eq(orders.triaged, true));
  return { months: out, outstanding: num(outstanding?.unpaid) };
}

/** Flat list for the orders Excel export */
export async function ordersForExport(p: Period | null) {
  const where = p ? and(eq(orders.triaged, true), gte(orders.createdAt, range(p).start), lt(orders.createdAt, range(p).end)) : eq(orders.triaged, true);
  return db.query.orders.findMany({
    where,
    with: {
      client: { columns: { name: true } },
      site: { columns: { name: true, address: true } },
      assignees: { with: { user: { columns: { name: true } } } },
      materials: true,
      visits: { columns: { startedAt: true, endedAt: true } },
    },
    orderBy: [asc(orders.createdAt)],
  });
}

export async function clientsForExport() {
  return db.query.clients.findMany({ with: { sites: true }, orderBy: [asc(clients.name)] });
}

export const ACTIVE = inArray(orders.status, ["new", "assigned", "in_progress"]);
