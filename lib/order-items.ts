import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { recomputeOrderPayments } from "@/lib/payments";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The order total follows its billable lines. When an order has no lines the
 * manually entered amount is left alone, so orders created before the catalogue keep working.
 */
export async function recomputeOrderAmount(tx: Tx, orderId: number) {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`, n: sql<number>`count(*)`.mapWith(Number) })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (!row || row.n === 0) return;
  await tx.update(orders).set({ amount: row.total, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await recomputeOrderPayments(tx, orderId);
}
