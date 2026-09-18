import "server-only";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderAssignees, orderPayments, orders, quotes, user } from "@/db/schema";
import { reportMonthly } from "@/lib/reports";

const num = (v: unknown) => Number(v ?? 0);

/** First day of the month, `back` months ago, as a Tbilisi instant. */
function monthStart(back = 0): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
}

export type RevenueTrend = {
  months: { month: string; revenue: number; booked: number }[];
  thisMonth: number;
  lastMonth: number;
  /** Null when last month was zero: a percentage against nothing says nothing. */
  changePct: number | null;
  best: number;
};

export type AgingBucket = { key: string; label: string; days: string; amount: number; count: number };
export type Aging = { buckets: AgingBucket[]; total: number; overdue: number; oldest: { id: number; number: string; title: string; client: string | null; days: number; amount: number } | null };

export type CrewRow = { id: string; name: string; image: string | null; hours: number; completed: number; revenue: number; utilPct: number };

export type Conversion = { draft: number; sent: number; accepted: number; declined: number; rate: number | null; acceptedValue: number; openValue: number; avgValue: number };

/**
 * The four numbers that show where the business is heading, as opposed to what
 * is happening today. One round trip each, all in parallel.
 */
export async function getDashboardAnalytics(normHours: number) {
  const [trend, aging, crew, conversion] = await Promise.all([revenueTrend(), unpaidAging(), crewPerformance(normHours), quoteConversion()]);
  return { trend, aging, crew, conversion };
}

async function revenueTrend(): Promise<RevenueTrend> {
  const { months } = await reportMonthly(12);
  const rows = months.map((m) => ({ month: m.month, revenue: m.revenue, booked: m.booked }));
  const thisMonth = rows.at(-1)?.revenue ?? 0;
  const lastMonth = rows.at(-2)?.revenue ?? 0;
  return {
    months: rows,
    thisMonth,
    lastMonth,
    changePct: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
    best: Math.max(0, ...rows.map((r) => r.revenue)),
  };
}

const AGING_BUCKETS = [
  { key: "fresh", label: "ახალი", days: "0–30 დღე" },
  { key: "d30", label: "30+", days: "31–60 დღე" },
  { key: "d60", label: "60+", days: "61–90 დღე" },
  { key: "d90", label: "90+", days: "90 დღეზე მეტი" },
];

async function unpaidAging(): Promise<Aging> {
  // age runs from the handover, or from creation while the work is still open
  const age = sql<number>`greatest(0, date_part('day', now() - coalesce(${orders.completedAt}, ${orders.createdAt})))`;
  const balance = sql<string>`greatest(${orders.amount} - ${orders.paidTotal}, 0)`;
  const unpaid = and(eq(orders.triaged, true), ne(orders.status, "cancelled"), sql`${orders.amount} is not null`, sql`${orders.amount} - ${orders.paidTotal} > 0`);

  const [rows, oldestRow] = await Promise.all([
    db
      .select({
        bucket: sql<string>`case when ${age} <= 30 then 'fresh' when ${age} <= 60 then 'd30' when ${age} <= 90 then 'd60' else 'd90' end`,
        amount: sql<string>`coalesce(sum(${balance}), 0)`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(unpaid)
      .groupBy(sql`1`),
    db
      .select({ id: orders.id, number: orders.number, title: orders.title, client: sql<string | null>`(select name from clients c where c.id = ${orders.clientId})`, days: age, amount: balance })
      .from(orders)
      .where(unpaid)
      .orderBy(sql`${age} desc`)
      .limit(1),
  ]);

  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const buckets = AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, days: b.days, amount: num(byKey.get(b.key)?.amount), count: byKey.get(b.key)?.count ?? 0 }));
  const oldest = oldestRow[0];
  return {
    buckets,
    total: buckets.reduce((s, b) => s + b.amount, 0),
    overdue: buckets.filter((b) => b.key !== "fresh").reduce((s, b) => s + b.amount, 0),
    oldest: oldest ? { id: oldest.id, number: oldest.number, title: oldest.title, client: oldest.client, days: Math.round(num(oldest.days)), amount: num(oldest.amount) } : null,
  };
}

async function crewPerformance(normHours: number): Promise<CrewRow[]> {
  const start = monthStart();
  const end = monthStart(-1);
  // an order with two technicians splits its money between them, so nothing is counted twice
  const share = sql<string>`coalesce(${orders.amount}, 0) / greatest((select count(*) from order_assignees oa2 where oa2.order_id = ${orders.id}), 1)`;
  // completed_at survives a reopen, so the status has the final say on what counts as handed over
  const handedOver = sql`${orders.completedAt} >= ${start} and ${orders.completedAt} < ${end} and ${orders.status} in ('done','closed')`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      // an unplanned visit still books the default two hours, the same as on the schedule
      minutes: sql<number>`coalesce(sum(coalesce(${orders.plannedMinutes}, 120)) filter (where ${orders.scheduledAt} >= ${start} and ${orders.scheduledAt} < ${end}), 0)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${handedOver})`.mapWith(Number),
      revenue: sql<string>`coalesce(sum(${share}) filter (where ${handedOver}), 0)`,
    })
    .from(user)
    .innerJoin(orderAssignees, eq(orderAssignees.userId, user.id))
    .innerJoin(orders, eq(orders.id, orderAssignees.orderId))
    .where(and(eq(user.role, "executor"), eq(orders.triaged, true), ne(orders.status, "cancelled")))
    .groupBy(user.id, user.name, user.image);

  // working days so far this month, so the bar compares like with like
  const today = new Date();
  const daysSoFar = Math.max(1, today.getUTCDate());
  const capacity = daysSoFar * normHours;

  return rows
    .map((r) => {
      const hours = Math.round((r.minutes / 60) * 10) / 10;
      return { id: r.id, name: r.name, image: r.image, hours, completed: r.completed, revenue: num(r.revenue), utilPct: Math.min(100, Math.round((hours / capacity) * 100)) };
    })
    .sort((a, b) => b.revenue - a.revenue || b.completed - a.completed);
}

async function quoteConversion(): Promise<Conversion> {
  const since = monthStart(2); // this month plus the two before it
  const rows = await db
    .select({ status: quotes.status, n: sql<number>`count(*)`.mapWith(Number), total: sql<string>`coalesce(sum(${quotes.total}), 0)` })
    .from(quotes)
    .where(gte(quotes.createdAt, since))
    .groupBy(quotes.status);

  const by = (s: string) => rows.find((r) => r.status === s);
  const draft = by("draft")?.n ?? 0;
  const sent = by("sent")?.n ?? 0;
  const accepted = by("accepted")?.n ?? 0;
  const declined = by("declined")?.n ?? 0;
  const decided = accepted + declined;
  const acceptedValue = num(by("accepted")?.total);
  return {
    draft,
    sent,
    accepted,
    declined,
    rate: decided > 0 ? Math.round((accepted / decided) * 100) : null,
    acceptedValue,
    openValue: num(by("sent")?.total) + num(by("draft")?.total),
    avgValue: accepted > 0 ? Math.round(acceptedValue / accepted) : 0,
  };
}

/** Payments in the last 14 days, for the hero sparkline. */
export async function recentCash(days = 14) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const rows = await db
    .select({ d: sql<string>`to_char(${orderPayments.paidAt} at time zone 'Asia/Tbilisi', 'YYYY-MM-DD')`, amount: sql<string>`coalesce(sum(${orderPayments.amount}), 0)` })
    .from(orderPayments)
    .where(gte(orderPayments.paidAt, start))
    .groupBy(sql`1`);
  const map = new Map(rows.map((r) => [r.d, num(r.amount)]));
  const out: { day: string; amount: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, amount: map.get(key) ?? 0 });
  }
  return out;
}

