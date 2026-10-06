"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { orderAssignees, orderAttachments, orderChecklistItems, orderEvents, orders } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

async function access(orderId: number) {
  const s = await getSession();
  if (!s) throw new Error("ავტორიზაცია საჭიროა");
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new Error("შეკვეთა ვერ მოიძებნა");
  if (!isStaff(s.user.role)) {
    if (s.user.role !== "executor") throw new Error("არ გაქვთ უფლება");
    const assigned = await db.query.orderAssignees.findFirst({ where: and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, s.user.id)) });
    if (!assigned) throw new Error("ეს შეკვეთა თქვენთვის არ არის დანიშნული");
  }
  return s.user;
}

function revalidate(orderId: number) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/my");
}
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "შეცდომა" });

export async function getCompletionDetails(orderId: number) {
  try {
    const me = await access(orderId);
    const [checklist, photos] = await Promise.all([
      db.query.orderChecklistItems.findMany({ where: eq(orderChecklistItems.orderId, orderId), with: { doneByUser: { columns: { id: true, name: true } } }, orderBy: [asc(orderChecklistItems.position), asc(orderChecklistItems.id)] }),
      db.select({ id: orderAttachments.id, fileName: orderAttachments.fileName, mimeType: orderAttachments.mimeType, uploadedBy: orderAttachments.uploadedBy }).from(orderAttachments).where(and(eq(orderAttachments.orderId, orderId), isStaff(me.role) ? undefined : eq(orderAttachments.uploadedBy, me.id))),
    ]);
    return { ok: true as const, data: { checklist, photos: photos.filter(p => p.mimeType?.startsWith("image/")), staff: isStaff(me.role) } };
  } catch (e) { return fail(e); }
}

/** Lock the same order as completeOrder so checklist edits and handover cannot interleave. */
async function edit(orderId: number, change: { kind: "toggle"; id: number; done: boolean } | { kind: "add"; label: string; required: boolean } | { kind: "remove"; id: number }): Promise<ActionResult> {
  try {
    const me = await access(orderId);
    if ((change.kind === "toggle" && typeof change.done !== "boolean") || (change.kind === "add" && (typeof change.required !== "boolean" || typeof change.label !== "string"))) throw new Error("არასწორი მონაცემები");
    if (change.kind !== "toggle" && !isStaff(me.role)) throw new Error("პუნქტებს მხოლოდ მენეჯერი ცვლის");
    await db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order || (["closed", "cancelled", "done"].includes(order.status) && me.role !== "admin")) throw new Error("ჩეკ-ლისტის შესაცვლელად გახსენით შეკვეთა");
      if (!isStaff(me.role)) {
        const mine = await tx.query.orderAssignees.findFirst({ where: and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, me.id)) });
        if (!mine || mine.doneAt) throw new Error("სამუშაო უკვე ჩაბარებულია ან დანიშვნა შეიცვალა");
      }
      if (change.kind === "add") {
        const label = change.label.trim();
        if (!label || label.length > 500) throw new Error("ჩაწერეთ პუნქტი (მაქს. 500 სიმბოლო)");
        const [row] = await tx.select({ position: max(orderChecklistItems.position) }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, orderId));
        await tx.insert(orderChecklistItems).values({ orderId, label, required: change.required, position: (row?.position ?? 0) + 1 });
      } else {
        const condition = and(eq(orderChecklistItems.id, change.id), eq(orderChecklistItems.orderId, orderId));
        if (change.kind === "remove") await tx.delete(orderChecklistItems).where(condition);
        else await tx.update(orderChecklistItems).set({ done: change.done, doneBy: change.done ? me.id : null, doneAt: change.done ? new Date() : null }).where(condition);
      }
      await tx.insert(orderEvents).values({ orderId, userId: me.id, type: "checklist_changed", data: { action: change.kind } });
    });
    revalidate(orderId);
    return { ok: true };
  } catch (e) { return fail(e); }
}
export async function toggleChecklistItem(orderId: number, id: number, done: boolean) { return edit(orderId, { kind: "toggle", id, done }); }
export async function addChecklistItem(orderId: number, label: string, required: boolean) { return edit(orderId, { kind: "add", label, required }); }
export async function removeChecklistItem(orderId: number, id: number) { return edit(orderId, { kind: "remove", id }); }
