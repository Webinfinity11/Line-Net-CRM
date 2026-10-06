"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { orderAssignees, orderEvents, orderRequests, orders, sites, user } from "@/db/schema";
import { getSession, isStaff, requireUser } from "@/lib/session";
import { notifyUsers, staffUserIds } from "@/lib/notify";
import { syncAssignees } from "@/lib/assignees";
import { claimManagerIfEmpty } from "@/lib/order-team";
import type { ActionResult } from "./orders";
function refresh(id: number) { for (const p of ["/inbox", "/my", "/my/board", "/orders", `/orders/${id}`]) revalidatePath(p); }
export async function requestAssignment(orderId: number, userId?: string, note = ""): Promise<ActionResult> {
 const s = await getSession();
 if (!s || s.user.role !== "executor") return { ok: false, error: "არ გაქვთ უფლება" };
 const target = userId || s.user.id;
 const result = await db.transaction(async tx => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || !o.triaged || !["new", "assigned", "in_progress", "done"].includes(o.status)) return null;
  const people = await tx.select().from(orderAssignees).where(eq(orderAssignees.orderId, orderId));
  if (people.some(a => a.userId === target) || (target !== s.user.id && !people.some(a => a.userId === s.user.id))) return null;
  const person = await tx.query.user.findFirst({ where: and(eq(user.id, target), eq(user.role, "executor"), eq(user.banned, false)) });
  if (!person) return null;
  const [r] = await tx.insert(orderRequests).values({ orderId, userId: target, requestedBy: s.user.id, note: note.trim().slice(0, 1000) || null }).onConflictDoNothing().returning();
  return r;
 });
 if (!result) return { ok: false, error: "მოთხოვნა უკვე გაგზავნილია ან დანიშვნა შეუძლებელია" };
 await notifyUsers(await staffUserIds(), { type: "assignment_request", title: "შემსრულებლის მოთხოვნა", body: s.user.name, orderId });
 refresh(orderId); return { ok: true };
}
export async function decideRequest(id: number, approve: boolean): Promise<ActionResult> {
 const s = await getSession();
 if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
 const result = await db.transaction(async tx => {
  const initial = await tx.query.orderRequests.findFirst({ where: eq(orderRequests.id, id) });
  if (!initial) return null;
  const [o] = await tx.select().from(orders).where(eq(orders.id, initial.orderId)).for("update");
  const r = await tx.query.orderRequests.findFirst({ where: and(eq(orderRequests.id, id), eq(orderRequests.status, "pending")) });
  if (!r || !o || (approve && ["closed", "cancelled"].includes(o.status))) return null;
  const person = await tx.query.user.findFirst({ where: and(eq(user.id, r.userId), eq(user.role, "executor"), eq(user.banned, false)) });
  if (approve && !person) return null;
  await claimManagerIfEmpty(tx, o.id, s.user.id);
  if (approve) {
   const people = await tx.select().from(orderAssignees).where(eq(orderAssignees.orderId, o.id));
   const current = people.map(a => a.userId);
   await syncAssignees(tx, o.id, current, [...new Set([...current, r.userId])], s.user.id, false);
   await tx.update(orders).set({ ...(o.status === "done" && !current.includes(r.userId) ? { completedAt: null, finishedAt: null, completionNote: null } : {}), status: o.status === "new" ? "assigned" : o.status === "done" && !current.includes(r.userId) ? "in_progress" : o.status, updatedAt: new Date() }).where(eq(orders.id, o.id));
  }
  await tx.update(orderRequests).set({ status: approve ? "approved" : "declined", decidedBy: s.user.id, decidedAt: new Date() }).where(eq(orderRequests.id, id));
  await tx.insert(orderEvents).values({ orderId: o.id, userId: s.user.id, type: approve ? "request_approved" : "request_declined", data: { name: person?.name } });
  return { ...r, label: `${o.number} · ${o.title}` };
 });
 if (!result) return { ok: false, error: "მოთხოვნა უკვე განხილულია ან შეკვეთა დახურულია" };
 await notifyUsers([result.userId, result.requestedBy ?? ""], { type: approve ? "assigned" : "request_declined", ...(approve ? { title: "დანიშვნის მოთხოვნა დადასტურდა", orderId: result.orderId } : { title: "დანიშვნის მოთხოვნა უარყოფილია", body: result.label }) });
 refresh(result.orderId); return { ok: true };
}

export async function takeOrder(orderId: number): Promise<ActionResult> {
 const session = await getSession();
 if (!session || session.user.role !== "executor") return { ok: false, error: "არ გაქვთ უფლება" };
 const me = await requireUser(["executor"]);
 if (!Number.isSafeInteger(orderId) || orderId <= 0) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
 const result = await db.transaction(async tx => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || !o.triaged || !["new", "assigned", "in_progress"].includes(o.status)) return { error: "შეკვეთის აღება შეუძლებელია" };
  const people = await tx.select().from(orderAssignees).where(eq(orderAssignees.orderId, orderId));
  const current = people.map(a => a.userId);
  if (current.includes(me.id)) return { error: "უკვე დანიშნული ხართ" };
  const person = await tx.query.user.findFirst({ where: and(eq(user.id, me.id), eq(user.role, "executor"), eq(user.banned, false)) });
  if (!person) return { error: "არ გაქვთ უფლება" };
  const site = o.siteId ? await tx.query.sites.findFirst({ where: eq(sites.id, o.siteId), columns: { name: true } }) : undefined;
  await syncAssignees(tx, orderId, current, [...current, me.id], me.id, false, "self_assigned");
  // taking only assigns; work starts with „დაწყება“ (startVisit), so the order lands in the technician's „დასაწყები“
  await tx.update(orders).set({ ...(o.status === "new" ? { status: "assigned" as const } : {}), updatedAt: new Date() }).where(eq(orders.id, orderId));
  return { order: o, site: site?.name };
 });
 if ("error" in result) return { ok: false, error: result.error! };
 await notifyUsers(result.order.managerId ? [result.order.managerId] : await staffUserIds(), {
  type: "taken", title: `აიღო: ${me.name} · ${result.order.number} · ${result.site || "—"}`,
  body: result.order.title || result.order.description?.slice(0, 80), orderId,
 });
 refresh(orderId);
 revalidatePath("/portal");
 revalidatePath(`/portal/orders/${orderId}`);
 return { ok: true };
}

export async function addColleague(orderId: number, userId: string): Promise<ActionResult> {
 const session = await getSession();
 if (!session || session.user.role !== "executor") return { ok: false, error: "არ გაქვთ უფლება" };
 const me = await requireUser(["executor"]);
 if (!Number.isSafeInteger(orderId) || orderId <= 0 || typeof userId !== "string" || !userId.trim()) return { ok: false, error: "დანიშვნა შეუძლებელია" };
 const result = await db.transaction(async tx => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o || !o.triaged || !["new", "assigned", "in_progress"].includes(o.status)) return { error: "დანიშვნა შეუძლებელია" };
  const people = await tx.select().from(orderAssignees).where(eq(orderAssignees.orderId, orderId));
  const current = people.map(a => a.userId);
  if (!current.includes(me.id)) return { error: "შეკვეთაზე არ ხართ დანიშნული" };
  if (current.includes(userId)) return { error: "კოლეგა უკვე დანიშნულია" };
  const actor = await tx.query.user.findFirst({ where: and(eq(user.id, me.id), eq(user.role, "executor"), eq(user.banned, false)) });
  if (!actor) return { error: "არ გაქვთ უფლება" };
  const person = await tx.query.user.findFirst({ where: and(eq(user.id, userId), eq(user.role, "executor"), eq(user.banned, false)) });
  if (!person) return { error: "კოლეგის დამატება შეუძლებელია" };
  await syncAssignees(tx, orderId, current, [...current, userId], me.id, false);
  await tx.update(orders).set({ ...(o.status === "new" ? { status: "assigned" as const } : {}), updatedAt: new Date() }).where(eq(orders.id, orderId));
  return { order: o, name: person.name };
 });
 if ("error" in result) return { ok: false, error: result.error! };
 await notifyUsers([userId], { type: "assigned", title: `დაგენიშნათ შეკვეთა ${result.order.number}`, body: result.order.title, orderId }, { excludeUserId: me.id });
 await notifyUsers(result.order.managerId ? [result.order.managerId] : await staffUserIds(), {
  type: "taken", title: `${me.name}-მა დაამატა ${result.name} · ${result.order.number}`, orderId,
 });
 refresh(orderId);
 revalidatePath("/portal");
 revalidatePath(`/portal/orders/${orderId}`);
 return { ok: true };
}
