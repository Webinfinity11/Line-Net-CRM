"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { checklistTemplates, orderAssignees, orderChecklistItems, orderEvents, orderMaterials, orders } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

/** Executor must be assigned; staff always allowed. */
async function requireOrderAccess(orderId: number) {
  const s = await getSession();
  if (!s) throw new Error("ავტორიზაცია საჭიროა");
  if (isStaff(s.user.role)) return s.user;
  const [a] = await db.select().from(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, s.user.id)));
  if (!a) throw new Error("ეს შეკვეთა თქვენ არ გაქვთ დანიშნული");
  return s.user;
}

function revalidate(orderId: number) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/my");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Time on site
// ---------------------------------------------------------------------------

export async function markArrived(orderId: number): Promise<ActionResult> {
  try {
    const me = await requireOrderAccess(orderId);
    const now = new Date();
    const [o] = await db.select({ status: orders.status, arrivedAt: orders.arrivedAt }).from(orders).where(eq(orders.id, orderId));
    if (!o) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
    await db
      .update(orders)
      .set({
        arrivedAt: now,
        finishedAt: null,
        status: o.status === "assigned" || o.status === "new" ? "in_progress" : o.status,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));
    await db.insert(orderEvents).values({ orderId, userId: me.id, type: "arrived" });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

export async function markFinished(orderId: number): Promise<ActionResult> {
  try {
    const me = await requireOrderAccess(orderId);
    const now = new Date();
    const [o] = await db.select({ arrivedAt: orders.arrivedAt }).from(orders).where(eq(orders.id, orderId));
    if (!o) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
    await db
      .update(orders)
      .set({ finishedAt: now, arrivedAt: o.arrivedAt ?? now, updatedAt: now })
      .where(eq(orders.id, orderId));
    await db.insert(orderEvents).values({ orderId, userId: me.id, type: "finished" });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const materialInput = z.object({
  name: z.string().trim().min(1, "დასახელება სავალდებულოა").max(200),
  quantity: z.coerce.number().positive("რაოდენობა უნდა იყოს დადებითი").max(1000000),
  unit: z.string().trim().min(1).max(30).default("ცალი"),
  unitCost: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0).max(99999999).nullable()),
});

export async function addMaterial(orderId: number, fd: FormData): Promise<ActionResult> {
  try {
    const me = await requireOrderAccess(orderId);
    const parsed = materialInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
    const v = parsed.data;
    // Executors may add materials but not prices
    const unitCost = isStaff(me.role) ? v.unitCost : null;
    await db.insert(orderMaterials).values({
      orderId,
      name: v.name,
      quantity: v.quantity.toFixed(2),
      unit: v.unit,
      unitCost: unitCost === null ? null : unitCost.toFixed(2),
      createdBy: me.id,
    });
    await db.insert(orderEvents).values({ orderId, userId: me.id, type: "material_added", data: { name: v.name, quantity: v.quantity, unit: v.unit } });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

export async function updateMaterialCost(materialId: number, unitCost: number | null): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const [row] = await db.select().from(orderMaterials).where(eq(orderMaterials.id, materialId));
  if (!row) return { ok: false, error: "მასალა ვერ მოიძებნა" };
  await db
    .update(orderMaterials)
    .set({ unitCost: unitCost === null ? null : unitCost.toFixed(2) })
    .where(eq(orderMaterials.id, materialId));
  revalidate(row.orderId);
  return { ok: true };
}

export async function removeMaterial(materialId: number): Promise<ActionResult> {
  const [row] = await db.select().from(orderMaterials).where(eq(orderMaterials.id, materialId));
  if (!row) return { ok: false, error: "მასალა ვერ მოიძებნა" };
  try {
    const me = await requireOrderAccess(row.orderId);
    if (!isStaff(me.role) && row.createdBy !== me.id) return { ok: false, error: "მხოლოდ საკუთარი ჩანაწერის წაშლა შეგიძლიათ" };
    await db.delete(orderMaterials).where(eq(orderMaterials.id, materialId));
    await db.insert(orderEvents).values({ orderId: row.orderId, userId: me.id, type: "material_removed", data: { name: row.name } });
    revalidate(row.orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function toggleChecklistItem(itemId: number, done: boolean): Promise<ActionResult> {
  const [item] = await db.select().from(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  if (!item) return { ok: false, error: "პუნქტი ვერ მოიძებნა" };
  try {
    const me = await requireOrderAccess(item.orderId);
    await db
      .update(orderChecklistItems)
      .set({ done, doneBy: done ? me.id : null, doneAt: done ? new Date() : null })
      .where(eq(orderChecklistItems.id, itemId));
    if (done) {
      const remaining = await db
        .select({ id: orderChecklistItems.id })
        .from(orderChecklistItems)
        .where(and(eq(orderChecklistItems.orderId, item.orderId), eq(orderChecklistItems.done, false)));
      if (remaining.length === 0) await db.insert(orderEvents).values({ orderId: item.orderId, userId: me.id, type: "checklist_done" });
    }
    revalidate(item.orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

export async function addChecklistItem(orderId: number, label: string): Promise<ActionResult> {
  try {
    await requireOrderAccess(orderId);
    const text = label.trim();
    if (!text) return { ok: false, error: "ტექსტი ცარიელია" };
    const [m] = await db.select({ pos: max(orderChecklistItems.position) }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, orderId));
    await db.insert(orderChecklistItems).values({ orderId, label: text.slice(0, 300), position: (m?.pos ?? 0) + 1 });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "შეცდომა" };
  }
}

export async function removeChecklistItem(itemId: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const [item] = await db.select().from(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  if (!item) return { ok: false, error: "პუნქტი ვერ მოიძებნა" };
  await db.delete(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  revalidate(item.orderId);
  return { ok: true };
}

/** Copies a template's items into the order (appends). */
export async function applyChecklistTemplate(orderId: number, templateId: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const res = await applyTemplateInternal(orderId, templateId);
  revalidate(orderId);
  return res;
}

export async function applyTemplateInternal(orderId: number, templateId: number): Promise<ActionResult> {
  const [tpl] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, templateId));
  if (!tpl) return { ok: false, error: "შაბლონი ვერ მოიძებნა" };
  const [m] = await db.select({ pos: max(orderChecklistItems.position) }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, orderId));
  let pos = m?.pos ?? 0;
  if (tpl.items.length === 0) return { ok: true };
  await db.insert(orderChecklistItems).values(tpl.items.map((label) => ({ orderId, label, position: ++pos })));
  return { ok: true };
}

export async function listTemplates() {
  return db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.systemType), asc(checklistTemplates.name));
}
