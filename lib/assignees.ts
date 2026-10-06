import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { orderAssignees, orderEvents, orderRequests, notifications, orders, user } from "@/db/schema";
import { db } from "@/db";
import type { Tx } from "./order-team";
async function userNames(tx: Tx, ids: string[]) {
  if (ids.length === 0) return [];
  return tx.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids));
}

/** Adds/removes assignees inside a transaction. Returns the ids that were added so callers can notify after commit. */
export async function syncAssignees(tx: Tx, orderId: number, current: string[], next: string[], byUserId: string, resolveRequests = true, eventType: "assigned" | "self_assigned" = "assigned"): Promise<string[]> {
  const [order] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId)).for("update");
  current = (await tx.select({ userId: orderAssignees.userId }).from(orderAssignees).where(eq(orderAssignees.orderId, orderId))).map(a => a.userId);
  next = [...new Set(next)];
  const add = next.filter((u) => !current.includes(u));
  const remove = current.filter((u) => !next.includes(u));
  if (add.length) {
    if (order.status === "done") {
      await tx.update(orders).set({ status: "in_progress", completedAt: null, finishedAt: null, completionNote: null }).where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "status_changed", data: { from: "done", to: "in_progress" } });
    }
    await tx.insert(orderAssignees).values(add.map((u) => ({ orderId, userId: u, assignedBy: byUserId })));
    const names = await userNames(tx, add);
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: eventType, data: { users: names.map((n) => n.name) } });
  }
  if (remove.length) {
    await tx.delete(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), inArray(orderAssignees.userId, remove)));
    const names = await userNames(tx, remove);
    await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "unassigned", data: { users: names.map((n) => n.name) } });
  }
  if (resolveRequests && next.length) {
    const requests = await tx.update(orderRequests).set({ status: "approved", decidedBy: byUserId, decidedAt: new Date() }).where(and(eq(orderRequests.orderId, orderId), eq(orderRequests.status, "pending"), inArray(orderRequests.userId, next))).returning();
    for (const request of requests) {
      await tx.insert(orderEvents).values({ orderId, userId: byUserId, type: "request_approved", data: { userId: request.userId } });
      if (request.requestedBy && request.requestedBy !== byUserId && request.requestedBy !== request.userId) await tx.insert(notifications).values({ userId: request.requestedBy, orderId, type: "assigned", title: "კოლეგის დანიშვნის მოთხოვნა დადასტურდა" });
    }
  }
  return add;
}


/**
 * Validate untrusted assignment IDs before any mutation, including bulk and form actions.
 * Only ids not already on the order are checked, so a since-banned assignee can be kept or removed.
 */
export async function validAssigneeIds(ids: string[], alreadyAssigned: string[] = []): Promise<boolean> {
  if (!Array.isArray(ids) || ids.length > 200 || ids.some(id => typeof id !== "string" || !id)) return false;
  const unique = [...new Set(ids)].filter(id => !alreadyAssigned.includes(id));
  if (!unique.length) return true;
  const rows = await db.select({ id: user.id }).from(user).where(and(inArray(user.id, unique), inArray(user.role, ["admin", "manager", "executor"]), eq(user.banned, false)));
  return rows.length === unique.length;
}
