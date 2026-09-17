import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { recomputeOrderPayments } from "@/lib/payments";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The order total follows its billable lines, VAT included, because payments are
 * matched against what the client actually owes. When an order has no lines the
 * manually entered amount is left alone, so orders created before the catalogue keep working.
 */
export async function recomputeOrderAmount(tx: Tx, orderId: number) {
  const [row] = await tx
    .select({ net: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`, n: sql<number>`count(*)`.mapWith(Number) })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  if (!row || row.n === 0) return;
  const [order] = await tx.select({ vat: orders.vatPercent }).from(orders).where(eq(orders.id, orderId));
  const gross = grossFromNet(row.net, order?.vat);
  await tx.update(orders).set({ amount: gross, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await recomputeOrderPayments(tx, orderId);
}

/** Re-applies the total after the VAT rate itself changes. */
export async function recomputeOrderVat(tx: Tx, orderId: number) {
  await recomputeOrderAmount(tx, orderId);
}

function grossFromNet(net: string | number, vatPercent: string | number | null | undefined): string {
  const n = Number(net) || 0;
  const v = Number(vatPercent) || 0;
  return (Math.round(n * (1 + v / 100) * 100) / 100).toFixed(2);
}
