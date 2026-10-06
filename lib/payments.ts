import "server-only";
import { eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { orderPayments, orders } from "@/db/schema";
import { computePaymentStatus } from "@/lib/finance";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Recomputes paid_total, payment_status and paid_at from the payment rows. Call inside a transaction. */
export async function recomputeOrderPayments(tx: Tx, orderId: number) {
  const [o] = await tx.select({ amount: orders.amount, paidAt: orders.paidAt, status: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) return null;
  const [agg] = await tx.select({ total: sum(orderPayments.amount) }).from(orderPayments).where(eq(orderPayments.orderId, orderId));
  const paidTotal = Number(agg?.total ?? 0);
  const status = computePaymentStatus(o.amount, paidTotal);
  await tx
    .update(orders)
    .set({
      paidTotal: paidTotal.toFixed(2),
      paymentStatus: status,
      paidAt: status === "paid" ? (o.paidAt ?? new Date()) : null,
      paymentReviewNeeded: false,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
  return { paidTotal, status, previous: o.status };
}
