"use server";

import { and, eq, gte, isNotNull, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderAssignees, orderEvents, orders } from "@/db/schema";
import { notifyUsers } from "@/lib/notify";
import { plannedEnd, tbilisiDayBounds, tbilisiTime } from "@/lib/schedule-utils";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const input = z.object({
  assigneeId: z.string().min(1, "აირჩიეთ შემსრულებელი"),
  scheduledAt: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable()),
  plannedMinutes: z.coerce.number().int().min(15).max(1440).default(120),
});

function dayIso(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * The single "დანიშვნა" action used everywhere: one executor (replaces the current list),
 * optional time slot and duration. Returns an overlap warning instead of refusing.
 */
export async function assignOrder(orderId: number, fd: FormData): Promise<ActionResult<{ warning: string | null }>> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (existing.status === "closed" || existing.status === "cancelled") return { ok: false, error: "დახურული/გაუქმებული შეკვეთა არ ინიშნება" };

  const alreadyAssigned = existing.assignees.some((a) => a.userId === v.assigneeId);
  const removed = existing.assignees.filter((a) => a.userId !== v.assigneeId).map((a) => a.userId);
  const now = new Date();

  // overlap check on the same day for this executor (planned slots only)
  let warning: string | null = null;
  if (v.scheduledAt) {
    const { start, end } = tbilisiDayBounds(dayIso(v.scheduledAt));
    const others = await db
      .select({ id: orders.id, number: orders.number, scheduledAt: orders.scheduledAt, plannedMinutes: orders.plannedMinutes })
      .from(orders)
      .innerJoin(orderAssignees, eq(orderAssignees.orderId, orders.id))
      .where(and(eq(orderAssignees.userId, v.assigneeId), ne(orders.id, orderId), isNotNull(orders.scheduledAt), gte(orders.scheduledAt, start), lt(orders.scheduledAt, end), ne(orders.status, "cancelled"), ne(orders.status, "closed")));
    const myEnd = plannedEnd(v.scheduledAt, v.plannedMinutes);
    const clash = others.filter((o) => o.scheduledAt && o.scheduledAt < myEnd && plannedEnd(o.scheduledAt, o.plannedMinutes) > v.scheduledAt!);
    if (clash.length) warning = `დრო ემთხვევა: ${clash.map((o) => `${o.number} (${tbilisiTime(o.scheduledAt!)}–${tbilisiTime(plannedEnd(o.scheduledAt!, o.plannedMinutes))})`).join(", ")}`;
  }

  await db.transaction(async (tx) => {
    for (const userId of removed) await tx.delete(orderAssignees).where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, userId)));
    if (!alreadyAssigned) await tx.insert(orderAssignees).values({ orderId, userId: v.assigneeId, assignedBy: s.user.id });
    await tx
      .update(orders)
      .set({
        status: existing.status === "new" ? "assigned" : existing.status,
        scheduledAt: v.scheduledAt ?? existing.scheduledAt,
        plannedMinutes: v.scheduledAt ? v.plannedMinutes : existing.plannedMinutes,
        dueDate: existing.dueDate ?? (v.scheduledAt ? dayIso(v.scheduledAt) : null),
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));
    if (!alreadyAssigned || removed.length) await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "assigned", data: { users: [v.assigneeId], removed } });
    if (v.scheduledAt) await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "scheduled", data: { scheduledAt: v.scheduledAt.toISOString(), plannedMinutes: v.plannedMinutes } });
  });

  if (!alreadyAssigned) {
    await notifyUsers([v.assigneeId], { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: v.scheduledAt ? `${existing.title} · ${dayIso(v.scheduledAt)} ${tbilisiTime(v.scheduledAt)}` : existing.title, orderId }, { excludeUserId: s.user.id });
  }
  for (const p of ["/", "/schedule", "/orders", `/orders/${orderId}`, "/my"]) revalidatePath(p);
  return { ok: true, data: { warning } };
}
