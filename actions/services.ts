"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders, services, systemTypeEnum } from "@/db/schema";
import { recomputeOrderAmount } from "@/lib/order-items";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const serviceInput = z.object({
  name: z.string().trim().min(2, "დასახელება ძალიან მოკლეა").max(200),
  systemType: z.preprocess(emptyToNull, z.enum(systemTypeEnum.enumValues).nullable()),
  unit: z.string().trim().min(1).max(30).default("ცალი"),
  price: z.coerce.number().min(0).max(99999999),
  description: z.preprocess(emptyToNull, z.string().max(1000).nullable()),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(true),
});

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return null;
  return s.user;
}

function revalidateAll(orderId?: number) {
  revalidatePath("/settings/services");
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
}

export async function createService(fd: FormData): Promise<ActionResult> {
  if (!(await requireStaff())) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = serviceInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  await db.insert(services).values({ ...v, price: String(v.price) });
  revalidateAll();
  return { ok: true };
}

export async function updateService(id: number, fd: FormData): Promise<ActionResult> {
  if (!(await requireStaff())) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = serviceInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  await db
    .update(services)
    .set({ ...v, price: String(v.price), updatedAt: new Date() })
    .where(eq(services.id, id));
  revalidateAll();
  return { ok: true };
}

export async function setServiceActive(id: number, active: boolean): Promise<ActionResult> {
  if (!(await requireStaff())) return { ok: false, error: "არ გაქვთ უფლება" };
  await db.update(services).set({ active, updatedAt: new Date() }).where(eq(services.id, id));
  revalidateAll();
  return { ok: true };
}

/** Deleting a service keeps the lines already billed: they hold their own name and price. */
export async function deleteService(id: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me || me.role !== "admin") return { ok: false, error: "წაშლა მხოლოდ ადმინს შეუძლია" };
  await db.delete(services).where(eq(services.id, id));
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Billable lines on an order
// ---------------------------------------------------------------------------

const itemInput = z.object({
  serviceId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  name: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  unit: z.string().trim().max(30).default("ცალი"),
  quantity: z.coerce.number().min(0.01).max(999999),
  unitPrice: z.coerce.number().min(0).max(99999999),
});

export async function addOrderItem(orderId: number, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = itemInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (order.status === "closed" && me.role !== "admin") return { ok: false, error: "დახურული შეკვეთა არ იცვლება" };

  let name = v.name;
  let unit = v.unit;
  if (v.serviceId) {
    const [svc] = await db.select().from(services).where(eq(services.id, v.serviceId));
    if (!svc) return { ok: false, error: "სერვისი ვერ მოიძებნა" };
    name = name ?? svc.name;
    unit = unit || svc.unit;
  }
  if (!name) return { ok: false, error: "აირჩიეთ სერვისი ან ჩაწერეთ დასახელება" };

  await db.transaction(async (tx) => {
    await tx.insert(orderItems).values({
      orderId,
      serviceId: v.serviceId,
      name,
      unit,
      quantity: String(v.quantity),
      unitPrice: String(v.unitPrice),
      createdBy: me.id,
    });
    await recomputeOrderAmount(tx, orderId);
  });
  revalidateAll(orderId);
  return { ok: true };
}

export async function updateOrderItem(itemId: number, quantity: number, unitPrice: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "რაოდენობა არასწორია" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: "ფასი არასწორია" };
  const [item] = await db.select({ orderId: orderItems.orderId }).from(orderItems).where(eq(orderItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  await db.transaction(async (tx) => {
    await tx.update(orderItems).set({ quantity: String(quantity), unitPrice: String(unitPrice) }).where(eq(orderItems.id, itemId));
    await recomputeOrderAmount(tx, item.orderId);
  });
  revalidateAll(item.orderId);
  return { ok: true };
}

export async function removeOrderItem(itemId: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const [item] = await db.select({ orderId: orderItems.orderId }).from(orderItems).where(eq(orderItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.id, itemId));
    await recomputeOrderAmount(tx, item.orderId);
  });
  revalidateAll(item.orderId);
  return { ok: true };
}
