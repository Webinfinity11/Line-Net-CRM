"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  orderAssignees,
  orderAttachments,
  orderChecklistItems,
  orderComments,
  orderEvents,
  orderPriorityEnum,
  orderVisits,
  orders,
  orderStatusEnum,
  orderTypeEnum,
  systemTypeEnum,
  user,
  type OrderStatus,
  type UserRole,
} from "@/db/schema";
import { applyTemplate, defaultTemplateFor } from "@/lib/checklists";
import { notifyUsers, staffUserIds } from "@/lib/notify";
import { addMonthsIso } from "@/lib/order-utils";
import { recomputeOrderPayments } from "@/lib/payments";
import { getSession, isStaff, type SessionUser } from "@/lib/session";
import { deleteStoredFile, saveFile } from "@/lib/storage";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const checkbox = (v: unknown) => v === "on" || v === "true" || v === true;

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
  plannedMinutes: z.preprocess(emptyToNull, z.coerce.number().int().min(15).max(1440).nullable()),
  warrantyMonths: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(240).nullable()),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).max(99999999).nullable()),
  requiresPhoto: z.preprocess(checkbox, z.boolean()).default(false),
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

/** Closed orders are frozen for everyone except admins; admin changes are logged by the caller. */
function assertEditable(status: OrderStatus, role: UserRole) {
  if (status === "closed" && role !== "admin") throw new Error("დახურული შეკვეთის ცვლილება მხოლოდ ადმინს შეუძლია");
}

function revalidateOrder(id?: number) {
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/inbox");
  revalidatePath("/my");
  revalidatePath("/schedule");
  if (id) revalidatePath(`/orders/${id}`);
}

async function userNames(tx: Tx, ids: string[]) {
  if (ids.length === 0) return [];
  return tx.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids));
}

/** Adds/removes assignees inside a transaction. Returns the ids that were added so callers can notify after commit. */
async function syncAssignees(tx: Tx, orderId: number, current: string[], next: string[], byUserId: string): Promise<string[]> {
  const add = next.filter((u) => !current.includes(u));
  const remove = current.filter((u) => !next.includes(u));
  if (add.length) {
    await tx.insert(orderAssignees).values(add.map((u) => ({ orderId, userId: u, assignedBy: byUserId })));
    const names = await userNames(tx, add);
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "assigned", data: { users: names.map((n) => n.name) } });
  }
  if (remove.length) {
    await tx.delete(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), inArray(orderAssignees.userId, remove)));
    const names = await userNames(tx, remove);
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "unassigned", data: { users: names.map((n) => n.name) } });
  }
  return add;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export async function createOrder(fd: FormData): Promise<ActionResult<{ id: number }>> {
  let me: SessionUser;
  try {
    me = await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = orderInput.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;

  // Order, history, assignees and the initial checklist commit together or not at all.
  const { id, title } = await db.transaction(async (tx) => {
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
        plannedMinutes: v.plannedMinutes,
        warrantyMonths: v.warrantyMonths,
        requiresPhoto: v.requiresPhoto,
        amount: v.amount === null ? null : v.amount.toFixed(2),
        status: v.assignees.length ? "assigned" : "new",
        createdBy: me.id,
      })
      .returning({ id: orders.id, title: orders.title });
    await tx.insert(orderEvents).values({ orderId: row.id, userId: me.id, type: "created" });
    if (v.assignees.length) await syncAssignees(tx, row.id, [], v.assignees, me.id);
    const tpl = await defaultTemplateFor(tx, v.systemType);
    if (tpl) await applyTemplate(tx, row.id, tpl.id);
    return row;
  });

  if (v.assignees.length) {
    await notifyUsers(v.assignees, { type: "assigned", title: "დაგენიშნათ შეკვეთა", body: title, orderId: id }, { excludeUserId: me.id });
  }
  revalidateOrder(id);
  return { ok: true, data: { id } };
}

export async function createOrderAndRedirect(fd: FormData) {
  const res = await createOrder(fd);
  if (!res.ok) return res;
  redirect(`/orders/${res.data!.id}`);
}

export async function updateOrder(id: number, fd: FormData): Promise<ActionResult> {
  let me: SessionUser;
  try {
    me = await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = orderInput.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  try {
    assertEditable(existing.status, me.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let added: string[] = [];
  await db.transaction(async (tx) => {
    const wasInbox = !existing.triaged;
    let status: OrderStatus = existing.status;
    if (status === "new" && v.assignees.length) status = "assigned";
    if (status === "assigned" && v.assignees.length === 0) status = "new";
    const amount = v.amount === null ? null : v.amount.toFixed(2);
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
        plannedMinutes: v.plannedMinutes,
        warrantyMonths: v.warrantyMonths,
        warrantyUntil: v.warrantyMonths && existing.completedAt ? addMonthsIso(existing.completedAt, v.warrantyMonths) : v.warrantyMonths ? existing.warrantyUntil : null,
        requiresPhoto: v.requiresPhoto || existing.requiresPhoto,
        amount,
        status,
        triaged: true,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
    if (amount !== existing.amount) await recomputeOrderPayments(tx, id);
    await tx.insert(orderEvents).values({
      orderId: id,
      userId: me.id,
      type: wasInbox ? "triaged" : existing.status === "closed" ? "edited_closed" : "updated",
      data: amount !== existing.amount ? { amountFrom: existing.amount, amountTo: amount } : undefined,
    });
    added = await syncAssignees(tx, id, existing.assignees.map((a) => a.userId), v.assignees, me.id);
    // a system set on an order that still has no checklist gets the default template
    if (v.systemType && v.systemType !== existing.systemType) {
      const [anyItem] = await tx.select({ id: orderChecklistItems.id }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, id)).limit(1);
      if (!anyItem) {
        const tpl = await defaultTemplateFor(tx, v.systemType);
        if (tpl) await applyTemplate(tx, id, tpl.id);
      }
    }
  });
  if (added.length) await notifyUsers(added, { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: v.title, orderId: id }, { excludeUserId: me.id });
  revalidateOrder(id);
  return { ok: true };
}

export async function setAssignees(id: number, userIds: string[]): Promise<ActionResult> {
  let me: SessionUser;
  try {
    me = await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  try {
    assertEditable(existing.status, me.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  let added: string[] = [];
  await db.transaction(async (tx) => {
    added = await syncAssignees(tx, id, existing.assignees.map((a) => a.userId), userIds, me.id);
    const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (existing.status === "new" && userIds.length) patch.status = "assigned";
    if (existing.status === "assigned" && userIds.length === 0) patch.status = "new";
    await tx.update(orders).set(patch).where(eq(orders.id, id));
  });
  if (added.length) await notifyUsers(added, { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: existing.title, orderId: id }, { excludeUserId: me.id });
  revalidateOrder(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Status flow
// ---------------------------------------------------------------------------

/** What an executor may do from each status. Completion goes through completeOrder(). */
const EXECUTOR_TRANSITIONS: Record<string, OrderStatus[]> = {
  assigned: ["in_progress"],
  in_progress: [],
  done: ["in_progress"],
};

/** Server-side completion gates: required checklist items and, when demanded, at least one photo. */
async function checkCompletionGates(orderId: number, requiresPhoto: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const missing = await db
    .select({ label: orderChecklistItems.label })
    .from(orderChecklistItems)
    .where(and(eq(orderChecklistItems.orderId, orderId), eq(orderChecklistItems.required, true), eq(orderChecklistItems.done, false)));
  if (missing.length) {
    return { ok: false, error: `შეუსრულებელია სავალდებულო პუნქტები: ${missing.map((m) => m.label).join("; ")}` };
  }
  if (requiresPhoto) {
    const files = await db.select({ mime: orderAttachments.mimeType }).from(orderAttachments).where(eq(orderAttachments.orderId, orderId));
    if (!files.some((a) => a.mime?.startsWith("image/"))) return { ok: false, error: "ამ სამუშაოს ჩასაბარებლად ფოტო სავალდებულოა" };
  }
  return { ok: true };
}

export async function setStatus(id: number, status: OrderStatus): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  if (!orderStatusEnum.enumValues.includes(status)) return { ok: false, error: "არასწორი სტატუსი" };
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (existing.status === status) return { ok: true };
  const staff = isStaff(s.user.role);

  if (!staff) {
    if (!existing.assignees.some((a) => a.userId === s.user.id)) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
    if (!EXECUTOR_TRANSITIONS[existing.status]?.includes(status)) return { ok: false, error: "ეს სტატუსი თქვენ ვერ დააყენებთ. ჩასაბარებლად გამოიყენეთ „სამუშაო შესრულებულია“." };
  } else {
    if (existing.status === "closed" && s.user.role !== "admin") return { ok: false, error: "დახურული შეკვეთის გახსნა მხოლოდ ადმინს შეუძლია" };
    if (status === "closed" && existing.status !== "done") return { ok: false, error: "დახურვამდე სამუშაო უნდა ჩაბარდეს (სტატუსი „შესრულებული“)" };
    if (status === "done") {
      const gate = await checkCompletionGates(id, existing.requiresPhoto);
      if (!gate.ok) return { ok: false, error: gate.error };
    }
  }

  const now = new Date();
  const completedAt = status === "done" ? now : status === "closed" ? (existing.completedAt ?? now) : existing.completedAt;
  const reopening = existing.status === "closed";
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        updatedAt: now,
        completedAt,
        closedAt: status === "closed" ? now : null,
        verifiedBy: status === "closed" ? s.user.id : reopening ? null : existing.verifiedBy,
        verifiedAt: status === "closed" ? now : reopening ? null : existing.verifiedAt,
        warrantyUntil: existing.warrantyMonths && completedAt ? addMonthsIso(completedAt, existing.warrantyMonths) : existing.warrantyUntil,
        triaged: true,
      })
      .where(eq(orders.id, id));
    await tx.insert(orderEvents).values({
      orderId: id,
      userId: s.user.id,
      type: reopening ? "reopened" : status === "closed" ? "verified_closed" : "status_changed",
      data: { from: existing.status, to: status },
    });
  });

  if ((status === "cancelled" || status === "closed") && staff) {
    await notifyUsers(
      existing.assignees.map((a) => a.userId),
      { type: "status", title: `${existing.number} ${status === "cancelled" ? "გაუქმდა" : "დაიხურა"}`, body: existing.title, orderId: id },
      { excludeUserId: s.user.id },
    );
  }
  revalidateOrder(id);
  return { ok: true };
}

/**
 * Executor (or staff) hands the work over: needs a short summary, all required checklist
 * items done and a photo when the order demands one. Ends the caller's open visit.
 */
export async function completeOrder(id: number, note: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const text = note.trim();
  if (text.length < 5) return { ok: false, error: "მოკლედ აღწერეთ, რა გაკეთდა (მინ. 5 სიმბოლო)" };
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  const staff = isStaff(s.user.role);
  if (!staff && !existing.assignees.some((a) => a.userId === s.user.id)) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
  if (!["assigned", "in_progress"].includes(existing.status)) return { ok: false, error: "ჩაბარება შესაძლებელია მხოლოდ დანიშნული ან მიმდინარე შეკვეთისთვის" };
  const gate = await checkCompletionGates(id, existing.requiresPhoto);
  if (!gate.ok) return { ok: false, error: gate.error };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(orderVisits)
      .set({ endedAt: now })
      .where(and(eq(orderVisits.orderId, id), eq(orderVisits.userId, s.user.id), isNull(orderVisits.endedAt)));
    await tx
      .update(orders)
      .set({
        status: "done",
        completedAt: now,
        completionNote: text.slice(0, 2000),
        finishedAt: existing.finishedAt ?? now,
        warrantyUntil: existing.warrantyMonths ? addMonthsIso(now, existing.warrantyMonths) : existing.warrantyUntil,
        updatedAt: now,
        triaged: true,
      })
      .where(eq(orders.id, id));
    await tx.insert(orderComments).values({ orderId: id, userId: s.user.id, body: `ჩაბარება: ${text.slice(0, 2000)}` });
    await tx.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: "status_changed", data: { from: existing.status, to: "done" } });
  });
  if (!staff) {
    await notifyUsers(await staffUserIds(), { type: "done", title: `${s.user.name}: შესრულებულია ${existing.number}`, body: text.slice(0, 200), orderId: id });
  }
  revalidateOrder(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments, attachments, delete
// ---------------------------------------------------------------------------

async function assigneeOrStaff(orderId: number, u: SessionUser) {
  if (isStaff(u.role)) return true;
  const [a] = await db.select().from(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, u.id)));
  return Boolean(a);
}

export async function addComment(id: number, body: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const text = body.trim();
  if (!text) return { ok: false, error: "კომენტარი ცარიელია" };
  if (!(await assigneeOrStaff(id, s.user))) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
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
  if (!(await assigneeOrStaff(id, s.user))) return { ok: false, error: "ეს შეკვეთა თქვენ არ გაქვთ დანიშნული" };
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveFile(`orders/${id}`, file.name, buf);
  await db.insert(orderAttachments).values({ orderId: id, fileName: file.name, mimeType: file.type || null, size: file.size, storagePath, uploadedBy: s.user.id });
  await db.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: "attachment_added", data: { fileName: file.name } });
  revalidateOrder(id);
  return { ok: true };
}

export async function deleteAttachment(attachmentId: number): Promise<ActionResult> {
  let me: SessionUser;
  try {
    me = await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const [row] = await db.select().from(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  if (!row) return { ok: false, error: "ფაილი ვერ მოიძებნა" };
  const [o] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, row.orderId));
  try {
    if (o) assertEditable(o.status, me.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await db.delete(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  await db.insert(orderEvents).values({ orderId: row.orderId, userId: me.id, type: "attachment_removed", data: { fileName: row.fileName } });
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
