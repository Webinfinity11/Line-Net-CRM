"use server";

import { applyDefaultChecklist } from "@/lib/checklists";
import { completionRecipients, completionTexts, clientCompletedText, clientClosedText } from "@/lib/completion-notify";
import { completionProblems } from "@/lib/completion-gates";

import { sendClientMail } from "@/lib/client-mail";
import { allAssigneesDone } from "@/lib/team-flow";
import { validAssigneeIds, syncAssignees } from "@/lib/assignees";
import { claimManagerIfEmpty } from "@/lib/order-team";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  orderAssignees,
  notifications,
  orderAttachments,
  orderChecklistItems,
  orderComments,
  orderEvents,
  orderPriorityEnum,
  orderVisits,
  orders,
  orderStatusEnum,
  orderTypeEnum,
  user,
  type OrderStatus,
  type UserRole,
} from "@/db/schema";
import { notifyUsers, staffUserIds } from "@/lib/notify";
import { commentNotification, commentRecipients, withoutAlreadyNotified } from "@/lib/comment-notify";
import { canAccessOrderComments } from "@/lib/comments";
import { addMonthsIso } from "@/lib/order-utils";
import { recomputeOrderAmount } from "@/lib/order-items";
import { recomputeOrderPayments } from "@/lib/payments";
import { shouldNotifyPortalAcceptance } from "@/lib/portal";
import { getSession, isStaff, type SessionUser } from "@/lib/session";
import { systemSlug } from "@/lib/systems";
import { deleteStoredFile, saveFile } from "@/lib/storage";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  systemType: z.preprocess(emptyToNull, systemSlug.nullable()),
  scheduledAt: z.preprocess(emptyToNull, z.coerce.date().nullable()),
  plannedMinutes: z.preprocess(emptyToNull, z.coerce.number().int().min(15).max(1440).nullable()),
  warrantyMonths: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(240).nullable()),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).max(99999999).nullable()),
  vatPercent: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()),
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
  revalidatePath("/portal");
  if (id) revalidatePath(`/orders/${id}`);
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
  const parsed = await orderInput.safeParseAsync(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  if (!await validAssigneeIds(v.assignees)) return { ok: false, error: "აირჩიეთ მოქმედი გუნდის წევრი" };

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
        amount: v.amount === null ? null : v.amount.toFixed(2),
        vatPercent: (v.vatPercent ?? 0).toFixed(2),
        status: v.assignees.length ? "assigned" : "new",
        createdBy: me.id,
      })
      .returning({ id: orders.id, title: orders.title });
    await tx.insert(orderEvents).values({ orderId: row.id, userId: me.id, type: "created" });
    if (v.assignees.length) await syncAssignees(tx, row.id, [], v.assignees, me.id);
    await applyDefaultChecklist(tx, row.id, v.systemType);
    return row;
  });

  if (v.assignees.length) {
    await notifyUsers(v.assignees, { type: "assigned", title: "დაგენიშნათ შეკვეთა", body: title, orderId: id }, { excludeUserId: me.id });
  }
  if (v.scheduledAt && v.assignees.length) await sendClientMail(id, "scheduled", me.id);
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
  const parsed = await orderInput.safeParseAsync(formToObject(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (!await validAssigneeIds(v.assignees, existing.assignees.map((a) => a.userId))) return { ok: false, error: "აირჩიეთ მოქმედი გუნდის წევრი" };
  try {
    assertEditable(existing.status, me.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // The form no longer carries deadline, duration, warranty or VAT; an absent field keeps what the order already has.
  const sent = (k: string) => fd.has(k);
  const plannedMinutes = sent("plannedMinutes") ? v.plannedMinutes : existing.plannedMinutes;
  const warrantyMonths = sent("warrantyMonths") ? v.warrantyMonths : existing.warrantyMonths;
  const vatPercent = sent("vatPercent") ? (v.vatPercent ?? Number(existing.vatPercent ?? 0)) : Number(existing.vatPercent ?? 0);
  // A deadline that only mirrored the visit day follows the visit; one set on purpose (a schedule, an older edit) stays.
  const mirrored = !existing.dueDate || (existing.scheduledAt !== null && existing.dueDate === localDateIso(existing.scheduledAt));
  const dueDate = sent("dueDate")
    ? (v.dueDate ?? (v.scheduledAt ? localDateIso(v.scheduledAt) : null))
    : mirrored && v.scheduledAt
      ? localDateIso(v.scheduledAt)
      : existing.dueDate;

  let added: string[] = [];
  let acceptedPortal = false;
  let receivedMail = false;
  let scheduledMail = false;
  const saved = await db.transaction(async (tx) => {
    // Lock before reading the transition so concurrent saves notify only once.
    const [current] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!current || (current.status === "closed" && me.role !== "admin")) return false;
    await claimManagerIfEmpty(tx, id, me.id);
    const currentAssignees = await tx.query.orderAssignees.findMany({ where: eq(orderAssignees.orderId, id) });
    if (!current.triaged && v.systemType && ["email", "portal"].includes(current.source)) {
      await applyDefaultChecklist(tx, id, v.systemType);
    }
    const wasInbox = !current.triaged;
    receivedMail = wasInbox;
    scheduledMail = Boolean(v.assignees.length && v.scheduledAt && v.scheduledAt.getTime() !== current.scheduledAt?.getTime());
    acceptedPortal = shouldNotifyPortalAcceptance(current.source, current.triaged, true);
    let status: OrderStatus = current.status;
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
        dueDate,
        systemType: v.systemType,
        scheduledAt: v.scheduledAt,
        plannedMinutes,
        warrantyMonths,
        warrantyUntil: warrantyMonths && existing.completedAt ? addMonthsIso(existing.completedAt, warrantyMonths) : warrantyMonths ? existing.warrantyUntil : null,
        amount,
        vatPercent: vatPercent.toFixed(2),
        status,
        triaged: true,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
    // A changed VAT rate moves the gross total, so the line-driven amount is redone first.
    const lineTotal = await recomputeOrderAmount(tx, id);
    if (lineTotal === undefined && amount !== current.amount) await recomputeOrderPayments(tx, id);
    await tx.insert(orderEvents).values({
      orderId: id,
      userId: me.id,
      type: wasInbox ? "triaged" : existing.status === "closed" ? "edited_closed" : "updated",
      data: (lineTotal ?? amount) !== current.amount ? { amountFrom: current.amount, amountTo: lineTotal ?? amount } : undefined,
    });
    added = await syncAssignees(tx, id, currentAssignees.map((a) => a.userId), v.assignees, me.id);
    return true;
  });
  if (!saved) return { ok: false, error: "შეკვეთა უკვე დახურულია" };
  if (added.length) await notifyUsers(added, { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: v.title, orderId: id }, { excludeUserId: me.id });
  if (acceptedPortal && v.clientId !== null) {
    const recipients = await db.select({ id: user.id }).from(user).where(and(eq(user.role, "client"), eq(user.clientId, v.clientId), eq(user.banned, false)));
    await notifyUsers(recipients.map((u) => u.id), {
      type: "portal",
      title: "თქვენი მოთხოვნა მიღებულია",
      body: `${existing.number} · ${v.title}`,
    });
  }
  if (receivedMail) await sendClientMail(id, "received", me.id);
  if (scheduledMail) await sendClientMail(id, "scheduled", me.id);
  revalidatePath("/portal");
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
  if (!await validAssigneeIds(userIds, existing.assignees.map((a) => a.userId))) return { ok: false, error: "აირჩიეთ მოქმედი გუნდის წევრი" };
  if (!existing.triaged && userIds.length) return { ok: false, error: "ჯერ დაამუშავეთ შეკვეთა („დამუშავება“)" };
  try {
    assertEditable(existing.status, me.role);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  let added: string[] = [];
  const saved = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!current || (current.status === "closed" && me.role !== "admin")) return false;
    await claimManagerIfEmpty(tx, id, me.id);
    added = await syncAssignees(tx, id, existing.assignees.map((a) => a.userId), userIds, me.id);
    const patch: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (current.status === "new" && userIds.length) patch.status = "assigned";
    if (current.status === "assigned" && userIds.length === 0) patch.status = "new";
    await tx.update(orders).set(patch).where(eq(orders.id, id));
    return true;
  });
  if (!saved) return { ok: false, error: "შეკვეთა უკვე დახურულია" };
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

export async function setStatus(id: number, status: OrderStatus, sendReport = false): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  if (!orderStatusEnum.enumValues.includes(status)) return { ok: false, error: "არასწორი სტატუსი" };
  if (status === "done") return { ok: false, error: "გამოიყენეთ „სამუშაო შესრულებულია“" };
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true, site: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (existing.status === status) return { ok: true };
  const staff = isStaff(s.user.role);

  if (!staff) {
    if (!existing.assignees.some((a) => a.userId === s.user.id)) return { ok: false, error: "ეს შეკვეთა თქვენთვის არ არის დანიშნული" };
    if (!EXECUTOR_TRANSITIONS[existing.status]?.includes(status)) return { ok: false, error: "ამ სტატუსს ვერ დააყენებთ. ჩასაბარებლად გამოიყენეთ „სამუშაო შესრულებულია“." };
  } else {
    if (existing.status === "closed" && s.user.role !== "admin") return { ok: false, error: "დახურული შეკვეთის გახსნა მხოლოდ ადმინს შეუძლია" };
    if (status === "closed" && existing.status !== "done") return { ok: false, error: "დახურვამდე სამუშაო უნდა ჩაბარდეს (სტატუსი „შესრულებული“)" };
  }

  const now = new Date();
  const resetHandover = ["new", "assigned", "in_progress"].includes(status) && ["done", "closed"].includes(existing.status);
  const completedAt = resetHandover ? null : status === "closed" ? (existing.completedAt ?? now) : existing.completedAt;
  const reopening = existing.status === "closed";
  const changed = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!current || current.status !== existing.status) return false;
    if (!staff) {
      const mine = await tx.query.orderAssignees.findFirst({ where: and(eq(orderAssignees.orderId, id), eq(orderAssignees.userId, s.user.id)) });
      if (s.user.role !== "executor" || !mine) return false;
    }
    if (staff) await claimManagerIfEmpty(tx, id, s.user.id);
    if (resetHandover) await tx.update(orderAssignees).set({ doneAt: null, doneNote: null }).where(eq(orderAssignees.orderId, id));
    await tx
      .update(orders)
      .set({
        status,
        updatedAt: now,
        completedAt,
        ...(resetHandover ? { finishedAt: null, completionNote: null, warrantyUntil: null } : {}),
        closedAt: status === "closed" ? now : null,
        verifiedBy: status === "closed" ? s.user.id : reopening ? null : existing.verifiedBy,
        verifiedAt: status === "closed" ? now : reopening ? null : existing.verifiedAt,
        warrantyUntil: resetHandover ? null : existing.warrantyMonths && completedAt ? addMonthsIso(completedAt, existing.warrantyMonths) : existing.warrantyUntil,
        triaged: true,
      })
      .where(eq(orders.id, id));
    if (["done", "closed", "cancelled"].includes(status)) await tx.update(orderVisits).set({ endedAt: now }).where(and(eq(orderVisits.orderId, id), isNull(orderVisits.endedAt)));
    await tx.insert(orderEvents).values({
      orderId: id,
      userId: s.user.id,
      type: reopening ? "reopened" : status === "closed" ? "verified_closed" : "status_changed",
      data: { from: existing.status, to: status },
    });
    return true;
  });
  if (!changed) return { ok: false, error: "შეკვეთის მდგომარეობა შეიცვალა. განაახლეთ გვერდი" };

  if ((status === "cancelled" || status === "closed") && staff) {
    await notifyUsers(
      existing.assignees.map((a) => a.userId),
      { type: "status", title: `${existing.number} ${status === "cancelled" ? "გაუქმდა" : "დაიხურა"}`, body: existing.title, orderId: id },
      { excludeUserId: s.user.id },
    );
  }
  if (status === "closed" && existing.clientId !== null) {
    const recipients = await db.select({ id: user.id }).from(user).where(and(eq(user.role, "client"), eq(user.clientId, existing.clientId), eq(user.banned, false)));
    await notifyUsers(recipients.map((u) => u.id), {
      type: "status", orderId: id,
      ...clientClosedText({ number: existing.number, siteName: existing.site?.name }),
    }, { email: false, excludeUserId: s.user.id });
  }
  if (staff && status === "closed" && sendReport) await sendClientMail(id, "completed", s.user.id);
  revalidateOrder(id);
  return { ok: true };
}

/**
 * Executor (or staff) hands the work over with a short summary.
 * Ends the caller's open visit.
 */
export async function completeOrder(id: number, note: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const text = note.trim();
  if (text.length < 5) return { ok: false, error: "მოკლედ აღწერეთ, რა გაკეთდა (მინ. 5 სიმბოლო)" };
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true, site: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  const staff = isStaff(s.user.role);
  if (!staff && (s.user.role !== "executor" || !existing.assignees.some((a) => a.userId === s.user.id))) return { ok: false, error: "ეს შეკვეთა თქვენთვის არ არის დანიშნული" };
  if (!["assigned", "in_progress"].includes(existing.status)) return { ok: false, error: "ჩაბარება შესაძლებელია მხოლოდ დანიშნული ან მიმდინარე შეკვეთისთვის" };

  const now = new Date();
  let gateError: string | undefined;
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!locked || !["assigned", "in_progress"].includes(locked.status)) return false;
    const people = await tx.query.orderAssignees.findMany({ where: eq(orderAssignees.orderId, id), with: { user: true } });
    const mine = people.find(p => p.userId === s.user.id);
    if (!staff && (!mine || mine.doneAt)) return false;
    const photos = await tx.select().from(orderAttachments).where(eq(orderAttachments.orderId, id));
    const checklist = await tx.select().from(orderChecklistItems).where(eq(orderChecklistItems.orderId, id));
    gateError = completionProblems({ note: text, attachments: photos, checklist, executorId: staff ? undefined : s.user.id, staff })[0];
    if (gateError) return false;
    if (!staff) {
      await tx.update(orderAssignees).set({ doneAt: now, doneNote: text.slice(0, 2000) }).where(and(eq(orderAssignees.orderId, id), eq(orderAssignees.userId, s.user.id)));
      mine!.doneAt = now; mine!.doneNote = text.slice(0, 2000);
    }
    const finished = staff || allAssigneesDone(people);
    await tx
      .update(orderVisits)
      .set({ endedAt: now })
      .where(and(eq(orderVisits.orderId, id), staff ? undefined : eq(orderVisits.userId, s.user.id), isNull(orderVisits.endedAt)));
    await tx
      .update(orders)
      .set({
        status: finished ? "done" : "in_progress",
        completedAt: finished ? now : null,
        completionNote: finished ? (staff ? text.slice(0, 2000) : people.map(p => `${p.user.name}: ${p.doneNote ?? ""}`).join("\n")) : null,
        finishedAt: finished ? now : null,
        warrantyUntil: finished && locked.warrantyMonths ? addMonthsIso(now, locked.warrantyMonths) : null,
        updatedAt: now,
        triaged: true,
      })
      .where(eq(orders.id, id));
    // the note lives on the order and is shown with the handover; a copy in the comments would only repeat it
    await tx.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: finished ? "status_changed" : "assignee_done", data: { from: locked.status, to: finished ? "done" : "in_progress" } });
    return { finished, managerId: locked.managerId, clientId: locked.clientId };
  });
  if (!result) return { ok: false, error: gateError ?? "შეკვეთა უკვე ჩაბარებულია ან დანიშვნა შეიცვალა" };
  const admins = await db.select({ id: user.id }).from(user).where(and(eq(user.role, "admin"), eq(user.banned, false)));
  const recipients = completionRecipients({
    managerId: result.managerId, staffIds: result.managerId ? [] : await staffUserIds(),
    adminIds: admins.map((u) => u.id), actorId: s.user.id,
  });
  const details = { number: existing.number, siteName: existing.site?.name, actorName: s.user.name };
  await notifyUsers(recipients, { type: "done", orderId: id, ...completionTexts({ ...details, partial: !result.finished }) });
  if (result.finished && result.clientId !== null) {
    const clients = await db.select({ id: user.id }).from(user).where(and(eq(user.role, "client"), eq(user.clientId, result.clientId), eq(user.banned, false)));
    await notifyUsers(clients.map((u) => u.id), {
      type: "done", orderId: id, ...clientCompletedText(details),
    }, { email: false, excludeUserId: s.user.id });
  }
  revalidateOrder(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments, attachments, delete
// ---------------------------------------------------------------------------

async function assigneeOrStaff(orderId: number, u: SessionUser) {
  return canAccessOrderComments(orderId, u);
}

export async function addComment(id: number, body: string): Promise<ActionResult<{ id: number; createdAt: string }>> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const text = body.trim();
  if (!text) return { ok: false, error: "კომენტარი ცარიელია" };
  if (!(await canAccessOrderComments(id, s.user))) return { ok: false, error: "ეს შეკვეთა თქვენთვის არ არის დანიშნული" };
  const [order] = await db.select({ id: orders.id, number: orders.number, managerId: orders.managerId }).from(orders).where(eq(orders.id, id));
  if (!order) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  const [comment] = await db
    .insert(orderComments)
    .values({ orderId: id, userId: s.user.id, body: text.slice(0, 5000) })
    .returning({ id: orderComments.id, createdAt: orderComments.createdAt });
  await db.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, id));
  try {
    const assignees = await db.select({ userId: orderAssignees.userId }).from(orderAssignees).where(eq(orderAssignees.orderId, id));
    const recipients = commentRecipients({
      authorId: s.user.id,
      managerId: order.managerId,
      staffIds: order.managerId ? [] : await staffUserIds(),
      assigneeIds: assignees.map((a) => a.userId),
    });
    if (recipients.length) {
      // One unread comment notification per person and order: further messages do not pile up in the bell.
      const unread = await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(and(inArray(notifications.userId, recipients), eq(notifications.orderId, id), eq(notifications.type, "comment"), isNull(notifications.readAt)));
      const fresh = withoutAlreadyNotified(recipients, unread.map((r) => r.userId));
      await notifyUsers(fresh, { ...commentNotification(s.user.name, order.number, text), orderId: id }, { email: false });
    }
  } catch (e) {
    console.error("comment notification failed", e);
  }
  revalidateOrder(id);
  return { ok: true, data: { id: comment.id, createdAt: comment.createdAt.toISOString() } };
}

export async function uploadAttachment(id: number, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "ფაილი არ არის არჩეული" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "ფაილი 4 MB-ზე დიდია" };
  if (!(await assigneeOrStaff(id, s.user))) return { ok: false, error: "ეს შეკვეთა თქვენთვის არ არის დანიშნული" };
  const target = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { status: true } });
  if (target?.status === "closed" && s.user.role !== "admin") return { ok: false, error: "დახურულ შეკვეთაზე ფაილი არ ემატება" };
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

export async function takeOverOrder(id: number, onlyIfEmpty = false): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!o) return { ok: false as const, error: "შეკვეთა ვერ მოიძებნა" };
    if (onlyIfEmpty && o.managerId && o.managerId !== s.user.id) return { ok: false as const, error: "შეკვეთა უკვე აიღო სხვა მენეჯერმა" };
    if (o.managerId === s.user.id) return { ok: true as const, previous: null };
    const previous = o.managerId ? await tx.query.user.findFirst({ where: eq(user.id, o.managerId) }) : null;
    await tx.update(orders).set({ managerId: s.user.id, managerAt: new Date() }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: "manager_changed", data: { from: previous?.name ?? null, to: s.user.name } });
    return { ok: true as const, previous: o.managerId };
  });
  if (!result.ok) return result;
  if (result.previous) await notifyUsers([result.previous], { type: "manager_changed", title: "შეკვეთის პასუხისმგებელი შეიცვალა", body: s.user.name, orderId: id });
  revalidateOrder(id);
  return { ok: true };
}

export async function setPriority(id: number, priority: string): Promise<ActionResult> {
 const s = await getSession();
 if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
 const value = z.enum(orderPriorityEnum.enumValues).safeParse(priority);
 if (!value.success) return { ok: false, error: "არასწორი პრიორიტეტი" };
 const ok = await db.transaction(async tx => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
  if (!o || (o.status === "closed" && s.user.role !== "admin")) return false;
  await claimManagerIfEmpty(tx, id, s.user.id);
  if (o.priority !== value.data) {
   await tx.update(orders).set({ priority: value.data, updatedAt: new Date() }).where(eq(orders.id, id));
   await tx.insert(orderEvents).values({ orderId: id, userId: s.user.id, type: "priority_changed", data: { from: o.priority, to: value.data } });
  } return true;
 });
 revalidateOrder(id); return ok ? { ok: true } : { ok: false, error: "შეკვეთა არ იცვლება" };
}
