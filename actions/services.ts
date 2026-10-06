"use server";

import { claimManagerIfEmpty } from "@/lib/order-team";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderAssignees, orderItems, orders, services } from "@/db/schema";
import { recomputeOrderAmount } from "@/lib/order-items";
import type { Tx } from "@/lib/order-team";
import { getSession, isStaff } from "@/lib/session";
import { subgroupBelongs } from "@/lib/subgroups";
import { systemSlug } from "@/lib/systems";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const serviceInput = z.object({
  name: z.string().trim().min(2, "დასახელება ძალიან მოკლეა").max(200),
  systemType: z.string({ error: "აირჩიეთ კატეგორია" }).trim().min(1, "აირჩიეთ კატეგორია").pipe(systemSlug),
  subgroupId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  unit: z.string().trim().min(1).max(30).default("ცალი"),
  price: z.coerce.number().min(0).max(99999999),
  description: z.preprocess(emptyToNull, z.string().max(1000).nullable()),
  sort: z.coerce.number().int().min(0).max(9999).default(0),
}).refine(async (v) => v.subgroupId === null || await subgroupBelongs(v.subgroupId, v.systemType), {
  message: "ქვეჯგუფი სხვა კატეგორიისაა", path: ["subgroupId"],
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
  const parsed = await serviceInput.safeParseAsync(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  // an unticked checkbox is absent from FormData; the form always renders it, ticked for a new service
  const active = fd.get("active") === "on";
  await db.insert(services).values({ ...v, active, price: String(v.price) });
  revalidateAll();
  return { ok: true };
}

export async function updateService(id: number, fd: FormData): Promise<ActionResult> {
  if (!(await requireStaff())) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = await serviceInput.safeParseAsync(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  // an unticked checkbox is absent from FormData; the form always renders it, ticked for a new service
  const active = fd.get("active") === "on";
  await db
    .update(services)
    .set({ ...v, active, price: String(v.price), updatedAt: new Date() })
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
  unitPrice: z.coerce.number().min(0).max(99999999).optional(),
});

export async function addOrderItem(orderId: number, fd: FormData): Promise<ActionResult> {
  const me = (await getSession())?.user;
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const input = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  if (!isStaff(me.role)) delete input.unitPrice;
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!order) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (order.status === "closed" && me.role !== "admin") return { ok: false, error: "დახურული შეკვეთა არ იცვლება" };

  let name = v.name;
  let unit = v.unit;
  let unitPrice = isStaff(me.role) && v.unitPrice !== undefined ? String(v.unitPrice) : "0";
  if (v.serviceId) {
    const [svc] = await db.select().from(services).where(eq(services.id, v.serviceId));
    if (!svc) return { ok: false, error: "სერვისი ვერ მოიძებნა" };
    name = name ?? svc.name;
    unit = unit || svc.unit;
    if (!isStaff(me.role) || v.unitPrice === undefined) unitPrice = svc.price;
  }
  if (!name) return { ok: false, error: "აირჩიეთ სერვისი ან ჩაწერეთ დასახელება" };

  const allowed = await db.transaction(async (tx) => {
    if (!await canEditItem(tx, orderId, me)) return false;
    if (isStaff(me.role)) await claimManagerIfEmpty(tx, orderId, me.id);
    await tx.insert(orderItems).values({
      orderId,
      serviceId: v.serviceId,
      name,
      unit,
      quantity: String(v.quantity),
      unitPrice,
      createdBy: me.id,
    });
    await recomputeOrderAmount(tx, orderId);
    return true;
  });
  if (!allowed) return { ok: false, error: "ამ პოზიციის შეცვლის უფლება არ გაქვთ" };
  revalidateAll(orderId);
  return { ok: true };
}

export async function updateOrderItem(itemId: number, quantity: number, unitPrice?: number | null): Promise<ActionResult> {
  const me = (await getSession())?.user;
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "რაოდენობა არასწორია" };
  const updatePrice = isStaff(me.role) && unitPrice != null;
  if (updatePrice && (!Number.isFinite(unitPrice) || unitPrice < 0)) return { ok: false, error: "ფასი არასწორია" };
  const [item] = await db.select({ orderId: orderItems.orderId, createdBy: orderItems.createdBy }).from(orderItems).where(eq(orderItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  const allowed = await db.transaction(async (tx) => {
    if (!await canEditItem(tx, item.orderId, me, item.createdBy)) return false;
    await tx.update(orderItems).set({ quantity: String(quantity), ...(updatePrice ? { unitPrice: String(unitPrice) } : {}) }).where(eq(orderItems.id, itemId));
    await recomputeOrderAmount(tx, item.orderId);
    return true;
  });
  if (!allowed) return { ok: false, error: "ამ პოზიციის შეცვლის უფლება არ გაქვთ" };
  revalidateAll(item.orderId);
  return { ok: true };
}

export async function removeOrderItem(itemId: number): Promise<ActionResult> {
  const me = (await getSession())?.user;
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const [item] = await db.select({ orderId: orderItems.orderId, createdBy: orderItems.createdBy }).from(orderItems).where(eq(orderItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  const allowed = await db.transaction(async (tx) => {
    if (!await canEditItem(tx, item.orderId, me, item.createdBy)) return false;
    await tx.delete(orderItems).where(eq(orderItems.id, itemId));
    await recomputeOrderAmount(tx, item.orderId, true);
    return true;
  });
  if (!allowed) return { ok: false, error: "ამ პოზიციის შეცვლის უფლება არ გაქვთ" };
  revalidateAll(item.orderId);
  return { ok: true };
}

async function canEditItem(tx: Tx, id: number, me: { id: string; role: string }, creator?: string | null) {
 const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
 if (!o) return false;
 if (me.role === "admin" || me.role === "manager") return o.status !== "closed" || me.role === "admin";
 if (me.role !== "executor" || !["assigned", "in_progress"].includes(o.status) || (creator !== undefined && creator !== me.id)) return false;
 return Boolean(await tx.query.orderAssignees.findFirst({ where: and(eq(orderAssignees.orderId, id), eq(orderAssignees.userId, me.id)) }));
}
