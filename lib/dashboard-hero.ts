import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderPayments } from "@/db/schema";
import { dashboardBuckets, type DashboardPeriod } from "@/lib/dashboard-period";
import type { SessionUser } from "@/lib/session";

export type HeroMetrics = {
  /** Orders handed over in the period, their gross total and what is still owed on them. */
  completed: number;
  amount: number;
  unpaid: number;
  /** Payments received in the period, and in the comparison window before it. */
  received: number;
  previous: number;
  changePct: number | null;
  /** Payments per bucket, for the line beside the number. */
  series: { label: string; amount: number }[];
};

export async function dashboardHeroMetrics(user: SessionUser, p: DashboardPeriod): Promise<HeroMetrics> {
  if (user.role !== "admin" && user.role !== "manager") throw new Error("Forbidden");
  const bucket = sql<number>`floor(extract(epoch from (${orderPayments.paidAt} - ${p.start.toISOString()}::timestamptz)) / ${p.step / 1000})`.mapWith(Number);
  const [[done], paid, [prev]] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        amount: sql<number>`coalesce(sum(${orders.amount}), 0)`.mapWith(Number),
        unpaid: sql<number>`coalesce(sum(greatest(${orders.amount} - ${orders.paidTotal}, 0)), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.triaged, true), inArray(orders.status, ["done", "closed"]), gte(orders.completedAt, p.start), lt(orders.completedAt, p.end))),
    db.select({ bucket, value: sql<number>`coalesce(sum(${orderPayments.amount}), 0)`.mapWith(Number) }).from(orderPayments).where(and(gte(orderPayments.paidAt, p.start), lt(orderPayments.paidAt, p.end))).groupBy(sql`1`),
    db.select({ value: sql<number>`coalesce(sum(${orderPayments.amount}), 0)`.mapWith(Number) }).from(orderPayments).where(and(gte(orderPayments.paidAt, p.previousStart), lt(orderPayments.paidAt, p.previousEnd))),
  ]);
  const byBucket = new Map(paid.map((r) => [r.bucket, r.value]));
  const received = paid.reduce((n, r) => n + r.value, 0);
  return {
    completed: done?.count ?? 0,
    amount: done?.amount ?? 0,
    unpaid: done?.unpaid ?? 0,
    received,
    previous: prev?.value ?? 0,
    changePct: prev && prev.value > 0 ? Math.round(((received - prev.value) / prev.value) * 100) : null,
    series: dashboardBuckets(p).map((b, i) => ({ label: b.label, amount: byBucket.get(i) ?? 0 })),
  };
}
