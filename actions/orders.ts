"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  orderAssignees,
  orderAttachments,
  orderComments,
  orderEvents,
  orderPriorityEnum,
  orders,
  orderStatusEnum,
  orderTypeEnum,
  paymentStatusEnum,
  systemTypeEnum,
  checklistTemplates,
  user,
  type OrderStatus,
} from "@/db/schema";
import { addMonthsIso } from "@/lib/order-utils";
import { getSession, isStaff, type SessionUser } from "@/lib/session";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { applyTemplateInternal } from "./order-work";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const orderInput = z.object({
  title: z.string().trim().min(2, "სათაური ძალიან მოკლეა").max(200),
  description: z.preprocess(emptyToNull, z.string().max(10000).nullable()),
  type: z.enum(orderTypeEnum.enumValues),
  priority: z.enum(orderPriorityEnum.enumValues),
  clientId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  siteId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  address: z.preprocess(emptyToNull, z.string().max(300).nullable()),
  dueDate: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  systemType: z.preprocess(emptyToNull, z.enum(systemTypeEnum.enumValues).nullable()),
  scheduledAt: z.preprocess(emptyToNull, z.coerce.date().nullable()),
  warrantyMonths: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(240).nullable()),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).max(99999999).nullable()),
  paymentStatus: z.enum(paymentStatusEnum.enumValues),
  assignees: z.array(z.string()).default([]),
});

/** Date → YYYY-MM-DD in Tbilisi time */
function localDateIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function formToObject(fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k === "assignees") {
      (obj.assignees ??= []) as string[];
      (obj.assignees as string[]).push(String(v));
    } else if (typeof v === "string") obj[k] = v;
  }
  obj.assignees ??= [];
  return obj;
}

async function requireStaff(): Promise<SessionUser> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

async function logEvent(orderId: number, userId: string | null, type: string, data?: Record<string, unknown>) {
  await db.insert(orderEvents).values({ orderId, userId, type, data });
}

function revalidateOrder(id?: number) {
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/inbox");
  revalidatePath("/my");
  if (id) revalidatePath(`/orders/${id}`);
}

// ---------------------------------------------------------------------------

export async function createOrder(fd: FormData): Promise<ActionResult<{ id: number }>> {
  const me = await requireStaff();
  const parsed = orderInput.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        title: v.title,
        description: v.description,
        type: v.type,
        priority: v.priority,
        clientId: v.clientId,
        siteId: v.siteId,
        address: v.address,
        dueDate: v.dueDate ?? (v.scheduledAt ? localDateIso(v.scheduledAt) : null),
        systemType: v.systemType,
        scheduledAt: v.scheduledAt,
        warrantyMonths: v.warrantyMonths,
        amount: v.amount === null ? null : v.amount.toFixed(2),
        paymentStatus: v.paymentStatus,
        paidAt: v.paymentStatus === "paid" ? new Date() : null,
        status: v.assignees.length ? "assigned" : "new",
        createdBy: me.id,
      })
      .returning({ id: orders.id });
    await tx.insert(orderEvents).values({ orderId: row.id, userId: me.id, type: "created" });
    if (v.systemType) {
      const [tpl] = await tx
        .select({ id: checklistTemplates.id })
        .from(checklistTemplates)
        .where(and(eq(checklistTemplates.systemType, v.systemType), eq(checklistTemplates.isDefault, true)));
      if (tpl) await applyTemplateInternal(row.id, tpl.id);
    }
    if (v.assignees.length) {
      await tx.insert(orderAssignees).values(v.assignees.map((u) => ({ orderId: row.id, userId: u, assignedBy: me.id })));
      const names = await tx.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, v.assignees));
      await tx.insert(orderEvents).values({ orderId: row.id, userId: me.id, type: "assigned", data: { users: names.map((n) => n.name) } });
    }
    return row.id;
  });
  revalidateOrder(id);
  return { ok: true, data: { id } };
}

export async function createOrderAndRedirect(fd: FormData) {
  const res = await createOrder(fd);
  if (!res.ok) return res;
  redirect(`/orders/${res.data!.id}`);
}

export async function updateOrder(id: number, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = orderInput.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };

  await db.transaction(async (tx) => {
    const wasInbox = !existing.triaged;
    let status: OrderStatus = existing.status;
    if (status === "new" && v.assignees.length) status = "assigned";
    if (status === "assigned" && v.assignees.length === 0) status = "new";
    await tx
      .update(orders)
      .set({
        title: v.title,
        description: v.description,
        type: v.type,
        priority: v.priority,
        clientId: v.clientId,
        siteId: v.siteId,
        address: v.address,
        dueDate: v.dueDate ?? (v.scheduledAt ? localDateIso(v.scheduledAt) : null),
        systemType: v.systemType,
        scheduledAt: v.scheduledAt,
        warrantyMonths: v.warrantyMonths,
        warrantyUntil:
          v.warrantyMonths && existing.completedAt ? addMonthsIso(existing.completedAt, v.warrantyMonths) : v.warrantyMonths ? existing.warrantyUntil : null,
        amount: v.amount === null ? null : v.amount.toFixed(2),
        paymentStatus: v.paymentStatus,
        paidAt: v.paymentStatus === "paid" ? (existing.paidAt ?? new Date()) : null,
        status,
        triaged: true,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, userId: me.id, type: wasInbox ? "triaged" : "updated" });
    if (existing.paymentStatus !== v.paymentStatus) {
      await tx.insert(orderEvents).values({ orderId: id, userId: me.id, type: "payment_changed", data: { from: existing.paymentStatus, to: v.paymentStatus } });
    }
    await syncAssignees(tx, id, existing.assignees.map((a) => a.userId), v.assignees, me.id);
  });
  revalidateOrder(id);
  return { ok: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function syncAssignees(tx: Tx, orderId: number, current: string[], next: string[], byUserId: string) {
  const add = next.filter((u) => !current.includes(u));
  const remove = current.filter((u) => !next.includes(u));
  if (add.length) {
    await tx.insert(orderAssignees).values(add.map((u) => ({ orderId, userId: u, assignedBy: byUserId })));
    const names = await tx.select({ name: user.name }).from(user).where(inArray(user.id, add));
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "assigned", data: { users: names.map((n) => n.name) } });
  }
  if (remove.length) {
    await tx.delete(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), inArray(orderAssignees.userId, remove)));
    const names = await tx.select({ name: user.name }).from(user).where(inArray(user.id, remove));
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "unassigned", data: { users: names.map((n) => n.name) } });
  }
}

export async function setAssignees(id: number, userIds: string[]): Promise<ActionResult> {
  const me = await requireStaff();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  await db.transaction(async (tx) => {
    await syncAssignees(tx, id, existing.assignees.map((a) => a.userId), userIds, me.id);
    const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (existing.status === "new" && userIds.length) patch.status = "assigned";
    if (existing.status === "assigned" && userIds.length === 0) patch.status = "new";
    await tx.update(orders).set(patch).where(eq(orders.id, id));
  });
  revalidateOrder(id);
  return { ok: true };
}

const EXECUTOR_TRANSITIONS: Record<string, OrderStatus[]> = {
  assigned: ["in_progress", "done"],
  in_progress: ["done"],
  done: ["in_progress"],
};

export async function setStatus(id: number, status: OrderStatus): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  if (!orderStatusEnum.enumValues.includes(status)) return { ok: false, error: "არასწორი სტატუსი" };
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };

  if (!isStaff(s.user.role)) {
    const isAssignee = existing.assignees.some((a) => a.userId === s.user.id);
    if (!isAssignee) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
    if (!EXECUTOR_TRANSITIONS[existing.status]?.includes(status)) return { ok: false, error: "ეს სტატუსი თქვენ ვერ დააყენებთ" };
  }
  if (existing.status === status) return { ok: true };

  const now = new Date();
  const completedAt = status === "done" ? now : status === "closed" ? (existing.completedAt ?? now) : existing.completedAt;
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        updatedAt: now,
        completedAt,
        closedAt: status === "closed" ? now : null,
        finishedAt: status === "done" && !existing.finishedAt && existing.arrivedAt ? now : existing.finishedAt,
        warrantyUntil: existing.warrantyMonths && completedAt ? addMonthsIso(completedAt, existing.warrantyMonths) : existing.warrantyUntil,
        triaged: true,
      })
      .where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: "status_changed", data: { from: existing.status, to: status } });
  });
  revalidateOrder(id);
  return { ok: true };
}

export async function setPaymentStatus(id: number, paymentStatus: (typeof paymentStatusEnum.enumValues)[number]): Promise<ActionResult> {
  const me = await requireStaff();
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { paymentStatus: true, paidAt: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (existing.paymentStatus === paymentStatus) return { ok: true };
  await db
    .update(orders)
    .set({ paymentStatus, paidAt: paymentStatus === "paid" ? (existing.paidAt ?? new Date()) : null, updatedAt: new Date() })
    .where(eq(orders.id, id));
  await logEvent(id, me.id, "payment_changed", { from: existing.paymentStatus, to: paymentStatus });
  revalidateOrder(id);
  return { ok: true };
}

export async function addComment(id: number, body: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const text = body.trim();
  if (!text) return { ok: false, error: "კომენტარი ცარიელია" };
  if (!isStaff(s.user.role)) {
    const [a] = await db.select().from(orderAssignees).where(and(eq(orderAssignees.orderId, id), eq(orderAssignees.userId, s.user.id)));
    if (!a) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
  }
  await db.insert(orderComments).values({ orderId: id, userId: s.user.id, body: text.slice(0, 5000) });
  await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, id));
  revalidateOrder(id);
  return { ok: true };
}

export async function uploadAttachment(id: number, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "ფაილი არ არის არჩეული" };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "ფაილი 25 MB-ზე დიდია" };
  if (!isStaff(s.user.role)) {
    const [a] = await db.select().from(orderAssignees).where(and(eq(orderAssignees.orderId, id), eq(orderAssignees.userId, s.user.id)));
    if (!a) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveFile(`orders/${id}`, file.name, buf);
  await db.insert(orderAttachments).values({ orderId: id, fileName: file.name, mimeType: file.type || null, size: file.size, storagePath, uploadedBy: s.user.id });
  await logEvent(id, s.user.id, "attachment_added", { fileName: file.name });
  revalidateOrder(id);
  return { ok: true };
}

export async function deleteAttachment(attachmentId: number): Promise<ActionResult> {
  await requireStaff();
  const [row] = await db.select().from(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  if (!row) return { ok: false, error: "ფაილი ვერ მოიძებნა" };
  await db.delete(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  await deleteStoredFile(row.storagePath);
  revalidateOrder(row.orderId);
  return { ok: true };
}

export async function deleteOrder(id: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია წაშლა" };
  const files = await db.select().from(orderAttachments).where(eq(orderAttachments.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
  await Promise.all(files.map((f) => deleteStoredFile(f.storagePath)));
  revalidateOrder();
  return { ok: true };
}

export async function markAssignmentSeen(orderId: number): Promise<void> {
  const s = await getSession();
  if (!s) return;
  await db
    .update(orderAssignees)
    .set({ seenAt: new Date() })
    .where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, s.user.id)));
}
