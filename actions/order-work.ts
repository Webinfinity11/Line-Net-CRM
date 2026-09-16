"use server";

import { and, asc, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderAssignees, orderChecklistItems, orderEvents, orderMaterials, orderVisits, orders, type OrderStatus, type UserRole } from "@/db/schema";
import { applyTemplate } from "@/lib/checklists";
import { getSession, isStaff, type SessionUser } from "@/lib/session";
import type { ActionResult } from "./orders";

type Access = { user: SessionUser; status: OrderStatus };

/** Executor must be assigned; staff always allowed. Closed orders are frozen except for admins. */
async function requireOrderAccess(orderId: number, opts: { allowClosed?: boolean } = {}): Promise<Access> {
  const s = await getSession();
  if (!s) throw new Error("ავტორიზაცია საჭიროა");
  const [o] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!o) throw new Error("შეკვეთა ვერ მოიძებნა");
  if (!isStaff(s.user.role)) {
    const [a] = await db.select().from(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, s.user.id)));
    if (!a) throw new Error("ეს შეკვეთა თქვენ არ გაქვთ დანიშნული");
  }
  if (!opts.allowClosed && o.status === "closed" && s.user.role !== "admin") throw new Error("დახურული შეკვეთის ცვლილება მხოლოდ ადმინს შეუძლია");
  if (o.status === "cancelled" && s.user.role !== "admin") throw new Error("გაუქმებული შეკვეთა არ იცვლება");
  return { user: s.user, status: o.status };
}

function revalidate(orderId: number) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/my");
  revalidatePath("/schedule");
  revalidatePath("/");
}

const fail = (e: unknown): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : "შეცდომა" });

// ---------------------------------------------------------------------------
// Visits (work sessions per executor)
// ---------------------------------------------------------------------------

export async function startVisit(orderId: number): Promise<ActionResult<{ visitId: number; resumed: boolean }>> {
  try {
    const { user: me, status } = await requireOrderAccess(orderId);
    if (status === "done" || status === "closed") return { ok: false, error: "შეკვეთა უკვე ჩაბარებულია. ახალი ვიზიტისთვის მენეჯერმა უნდა დააბრუნოს მიმდინარეში." };
    const [open] = await db
      .select({ id: orderVisits.id })
      .from(orderVisits)
      .where(and(eq(orderVisits.orderId, orderId), eq(orderVisits.userId, me.id), isNull(orderVisits.endedAt)));
    if (open) return { ok: true, data: { visitId: open.id, resumed: true } };
    const now = new Date();
    const visitId = await db.transaction(async (tx) => {
      const [v] = await tx.insert(orderVisits).values({ orderId, userId: me.id, startedAt: now }).returning({ id: orderVisits.id });
      await tx
        .update(orders)
        .set({
          arrivedAt: now, // legacy "first arrival" mirror, kept for old reports
          status: status === "assigned" || status === "new" ? "in_progress" : status,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values({ orderId, userId: me.id, type: "visit_started", data: { visitId: v.id } });
      return v.id;
    });
    revalidate(orderId);
    return { ok: true, data: { visitId, resumed: false } };
  } catch (e) {
    // unique partial index: a concurrent double-click loses the race and simply resumes
    if (e instanceof Error && /visits_active_unique/.test(e.message)) return { ok: true, data: { visitId: 0, resumed: true } };
    return fail(e);
  }
}

export async function endVisit(orderId: number, note?: string): Promise<ActionResult> {
  try {
    const { user: me } = await requireOrderAccess(orderId, { allowClosed: true });
    const [open] = await db
      .select({ id: orderVisits.id, startedAt: orderVisits.startedAt })
      .from(orderVisits)
      .where(and(eq(orderVisits.orderId, orderId), eq(orderVisits.userId, me.id), isNull(orderVisits.endedAt)));
    if (!open) return { ok: false, error: "აქტიური ვიზიტი არ გაქვთ" };
    const now = new Date();
    const minutes = Math.round((now.getTime() - open.startedAt.getTime()) / 60000);
    await db.transaction(async (tx) => {
      await tx.update(orderVisits).set({ endedAt: now, note: note?.trim() ? note.trim().slice(0, 1000) : null }).where(eq(orderVisits.id, open.id));
      await tx.update(orders).set({ finishedAt: now, updatedAt: now }).where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values({ orderId, userId: me.id, type: "visit_ended", data: { visitId: open.id, minutes } });
    });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
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
    const { user: me } = await requireOrderAccess(orderId);
    const parsed = materialInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
    const v = parsed.data;
    const unitCost = isStaff(me.role) ? v.unitCost : null; // executors never set prices
    await db.transaction(async (tx) => {
      await tx.insert(orderMaterials).values({ orderId, name: v.name, quantity: v.quantity.toFixed(2), unit: v.unit, unitCost: unitCost === null ? null : unitCost.toFixed(2), createdBy: me.id });
      await tx.insert(orderEvents).values({ orderId, userId: me.id, type: "material_added", data: { name: v.name, quantity: v.quantity, unit: v.unit } });
    });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMaterialCost(materialId: number, unitCost: number | null): Promise<ActionResult> {
  const [row] = await db.select().from(orderMaterials).where(eq(orderMaterials.id, materialId));
  if (!row) return { ok: false, error: "მასალა ვერ მოიძებნა" };
  try {
    const { user: me } = await requireOrderAccess(row.orderId);
    if (!isStaff(me.role)) return { ok: false, error: "ფასს მხოლოდ მენეჯერი ცვლის" };
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) return { ok: false, error: "ფასი არასწორია" };
    await db.update(orderMaterials).set({ unitCost: unitCost === null ? null : unitCost.toFixed(2) }).where(eq(orderMaterials.id, materialId));
    revalidate(row.orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMaterial(materialId: number): Promise<ActionResult> {
  const [row] = await db.select().from(orderMaterials).where(eq(orderMaterials.id, materialId));
  if (!row) return { ok: false, error: "მასალა ვერ მოიძებნა" };
  try {
    const { user: me } = await requireOrderAccess(row.orderId);
    if (!isStaff(me.role) && row.createdBy !== me.id) return { ok: false, error: "მხოლოდ საკუთარი ჩანაწერის წაშლა შეგიძლიათ" };
    await db.transaction(async (tx) => {
      await tx.delete(orderMaterials).where(eq(orderMaterials.id, materialId));
      await tx.insert(orderEvents).values({ orderId: row.orderId, userId: me.id, type: "material_removed", data: { name: row.name } });
    });
    revalidate(row.orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function toggleChecklistItem(itemId: number, done: boolean): Promise<ActionResult> {
  const [item] = await db.select().from(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  if (!item) return { ok: false, error: "პუნქტი ვერ მოიძებნა" };
  try {
    const { user: me } = await requireOrderAccess(item.orderId);
    await db.transaction(async (tx) => {
      await tx.update(orderChecklistItems).set({ done, doneBy: done ? me.id : null, doneAt: done ? new Date() : null }).where(eq(orderChecklistItems.id, itemId));
      if (done) {
        const remaining = await tx
          .select({ id: orderChecklistItems.id })
          .from(orderChecklistItems)
          .where(and(eq(orderChecklistItems.orderId, item.orderId), eq(orderChecklistItems.done, false)));
        if (remaining.length === 0) await tx.insert(orderEvents).values({ orderId: item.orderId, userId: me.id, type: "checklist_done" });
      }
    });
    revalidate(item.orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addChecklistItem(orderId: number, label: string, required = false): Promise<ActionResult> {
  try {
    const { user: me } = await requireOrderAccess(orderId);
    const text = label.trim();
    if (!text) return { ok: false, error: "ტექსტი ცარიელია" };
    const [m] = await db.select({ pos: max(orderChecklistItems.position) }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, orderId));
    await db.insert(orderChecklistItems).values({ orderId, label: text.slice(0, 300), required: isStaff(me.role) && required, position: (m?.pos ?? 0) + 1 });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setChecklistItemRequired(itemId: number, required: boolean): Promise<ActionResult> {
  const [item] = await db.select().from(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  if (!item) return { ok: false, error: "პუნქტი ვერ მოიძებნა" };
  try {
    const { user: me } = await requireOrderAccess(item.orderId);
    if (!isStaff(me.role)) return { ok: false, error: "სავალდებულოობას მხოლოდ მენეჯერი ცვლის" };
    await db.update(orderChecklistItems).set({ required }).where(eq(orderChecklistItems.id, itemId));
    revalidate(item.orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeChecklistItem(itemId: number): Promise<ActionResult> {
  const [item] = await db.select().from(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
  if (!item) return { ok: false, error: "პუნქტი ვერ მოიძებნა" };
  try {
    const { user: me } = await requireOrderAccess(item.orderId);
    if (!isStaff(me.role)) return { ok: false, error: "პუნქტის წაშლა მხოლოდ მენეჯერს შეუძლია" };
    await db.delete(orderChecklistItems).where(eq(orderChecklistItems.id, itemId));
    revalidate(item.orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Copies a template's items into the order (appends). Staff only. */
export async function applyChecklistTemplate(orderId: number, templateId: number): Promise<ActionResult> {
  try {
    const { user: me } = await requireOrderAccess(orderId);
    if (!isStaff(me.role)) return { ok: false, error: "შაბლონის დამატება მხოლოდ მენეჯერს შეუძლია" };
    await db.transaction(async (tx) => {
      await applyTemplate(tx, orderId, templateId);
      await tx.insert(orderEvents).values({ orderId, userId: me.id, type: "checklist_template_applied", data: { templateId } });
    });
    revalidate(orderId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type VisitRow = { id: number; startedAt: Date; endedAt: Date | null; userId: string };

/** Ordering helper used by the UI for a stable visit list */
export async function listOpenVisitForUser(orderId: number): Promise<VisitRow | null> {
  const s = await getSession();
  if (!s) return null;
  const rows = await db
    .select({ id: orderVisits.id, startedAt: orderVisits.startedAt, endedAt: orderVisits.endedAt, userId: orderVisits.userId })
    .from(orderVisits)
    .where(and(eq(orderVisits.orderId, orderId), eq(orderVisits.userId, s.user.id), isNull(orderVisits.endedAt)))
    .orderBy(asc(orderVisits.startedAt));
  return rows[0] ?? null;
}

export type { UserRole };
