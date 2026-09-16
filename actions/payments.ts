"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderEvents, orderPayments, orders } from "@/db/schema";
import { PAYMENT_METHODS } from "@/lib/finance";
import { recomputeOrderPayments } from "@/lib/payments";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const input = z.object({
  amount: z.coerce.number().positive("თანხა უნდა იყოს დადებითი").max(99999999),
  paidAt: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.date().optional()),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]).default("transfer"),
  note: z.preprocess((v) => (v === "" ? null : v), z.string().max(500).nullable().default(null)),
});

function revalidate(orderId: number) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/reports");
  revalidatePath("/");
}

export async function addPayment(orderId: number, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const [o] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!o) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (o.status === "cancelled") return { ok: false, error: "გაუქმებულ შეკვეთაზე გადახდა არ ემატება" };

  await db.transaction(async (tx) => {
    await tx.insert(orderPayments).values({ orderId, amount: v.amount.toFixed(2), paidAt: v.paidAt ?? new Date(), method: v.method, note: v.note, createdBy: s.user.id });
    const r = await recomputeOrderPayments(tx, orderId);
    await tx.insert(orderEvents).values({
      orderId,
      userId: s.user.id,
      type: "payment_added",
      data: { amount: v.amount, method: v.method, note: v.note, status: r?.status, paidTotal: r?.paidTotal },
    });
  });
  revalidate(orderId);
  return { ok: true };
}

export async function deletePayment(paymentId: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const [p] = await db.select().from(orderPayments).where(eq(orderPayments.id, paymentId));
  if (!p) return { ok: false, error: "გადახდა ვერ მოიძებნა" };
  if (s.user.role !== "admin" && p.createdBy !== s.user.id) return { ok: false, error: "სხვისი ჩანაწერის წაშლა მხოლოდ ადმინს შეუძლია" };
  await db.transaction(async (tx) => {
    await tx.delete(orderPayments).where(eq(orderPayments.id, paymentId));
    const r = await recomputeOrderPayments(tx, p.orderId);
    await tx.insert(orderEvents).values({ orderId: p.orderId, userId: s.user.id, type: "payment_removed", data: { amount: Number(p.amount), method: p.method, status: r?.status } });
  });
  revalidate(p.orderId);
  return { ok: true };
}

/** Clears the "needs review" flag once a manager has verified the migrated partial payment. */
export async function confirmPaymentReview(orderId: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  await db.transaction(async (tx) => {
    await recomputeOrderPayments(tx, orderId);
    await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "payment_reviewed" });
  });
  revalidate(orderId);
  return { ok: true };
}
