"use server";

import { validAssigneeIds, syncAssignees } from "@/lib/assignees";
import { sendClientMail } from "@/lib/client-mail";
import { claimManagerIfEmpty } from "@/lib/order-team";

import { and, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";
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

/** A deadline that only mirrored the visit day follows the visit (same rule as updateOrder); one set on purpose stays. */
function followVisitDueDate(dueDate: string | null, oldScheduledAt: Date | null, newScheduledAt: Date | null): string | null {
  if (!newScheduledAt) return dueDate;
  const mirrored = !dueDate || (oldScheduledAt !== null && dueDate === dayIso(oldScheduledAt));
  return mirrored ? dayIso(newScheduledAt) : dueDate;
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
  if (!await validAssigneeIds([v.assigneeId], existing.assignees.map((a) => a.userId))) return { ok: false, error: "აირჩიეთ მოქმედი გუნდის წევრი" };
  if (existing.status === "closed" || existing.status === "cancelled") return { ok: false, error: "დახურული/გაუქმებული შეკვეთა არ ინიშნება" };
  if (!existing.triaged) return { ok: false, error: "ჯერ დაამუშავეთ შეკვეთა („დამუშავება“)" };

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

  let newlyAssigned = false;
  let scheduledChanged = false;
  const saved = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!current || ["closed", "cancelled"].includes(current.status)) return false;
    await claimManagerIfEmpty(tx, orderId, s.user.id);
    const added = await syncAssignees(tx, orderId, [], [v.assigneeId], s.user.id);
    newlyAssigned = added.length > 0;
    scheduledChanged = Boolean(v.scheduledAt && v.scheduledAt.getTime() !== current.scheduledAt?.getTime());
    await tx.update(orders).set({
      status: current.status === "new" ? "assigned" : current.status === "done" && newlyAssigned ? "in_progress" : current.status,
      scheduledAt: v.scheduledAt ?? current.scheduledAt,
      plannedMinutes: v.scheduledAt ? v.plannedMinutes : current.plannedMinutes,
      dueDate: followVisitDueDate(current.dueDate, current.scheduledAt, v.scheduledAt), updatedAt: now,
    }).where(eq(orders.id, orderId));
    if (scheduledChanged) await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "scheduled", data: { scheduledAt: v.scheduledAt!.toISOString(), plannedMinutes: v.plannedMinutes } });
    return true;
  });
  if (!saved) return { ok: false, error: "შეკვეთა უკვე დახურული ან გაუქმებულია" };
  if (scheduledChanged) await sendClientMail(orderId, "scheduled", s.user.id);
  if (newlyAssigned) {
    await notifyUsers([v.assigneeId], { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: v.scheduledAt ? `${existing.title} · ${dayIso(v.scheduledAt)} ${tbilisiTime(v.scheduledAt)}` : existing.title, orderId }, { excludeUserId: s.user.id });
  }
  for (const p of ["/", "/schedule", "/orders", `/orders/${orderId}`, "/my"]) revalidatePath(p);
  return { ok: true, data: { warning } };
}

/**
 * Bulk "ჯგუფური დანიშვნა": the same rules as assignOrder applied to several orders
 * in one transaction. Closed, cancelled and missing orders are skipped, and the
 * executor gets a single notification for the whole batch.
 */
export async function assignMany(orderIds: number[], fd: FormData): Promise<ActionResult<{ assigned: number; skipped: number }>> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const ids = [...new Set(orderIds)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 200);
  if (ids.length === 0) return { ok: false, error: "შეკვეთები არ არის არჩეული" };
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  if (!await validAssigneeIds([v.assigneeId])) return { ok: false, error: "აირჩიეთ მოქმედი გუნდის წევრი" };

  const existing = await db.query.orders.findMany({ where: inArray(orders.id, ids), with: { assignees: true } });
  // Untriaged inbox orders are skipped: they must be processed first or the executor never sees them.
  const eligible = existing.filter((o) => o.status !== "closed" && o.status !== "cancelled" && o.triaged);
  if (eligible.length === 0) return { ok: false, error: existing.some((o) => !o.triaged) ? "ჯერ დაამუშავეთ შეკვეთა („დამუშავება“)" : "არჩეული შეკვეთები დახურული ან გაუქმებულია" };

  const now = new Date();
  const notify: { id: number; number: string }[] = [];
  const scheduledIds: number[] = [];
  let assignedCount = 0;
  await db.transaction(async (tx) => {
    for (const o of [...eligible].sort((a,b) => a.id-b.id)) {
      const [current] = await tx.select().from(orders).where(eq(orders.id, o.id)).for("update");
      if (!current || ["closed", "cancelled"].includes(current.status) || !current.triaged) continue;
      await claimManagerIfEmpty(tx, o.id, s.user.id);
      const added = await syncAssignees(tx, o.id, [], [v.assigneeId], s.user.id);
      await tx.update(orders).set({
        status: current.status === "new" ? "assigned" : current.status === "done" && added.length ? "in_progress" : current.status,
        scheduledAt: v.scheduledAt ?? current.scheduledAt,
        plannedMinutes: v.scheduledAt ? v.plannedMinutes : current.plannedMinutes,
        dueDate: followVisitDueDate(current.dueDate, current.scheduledAt, v.scheduledAt), updatedAt: now,
      }).where(eq(orders.id, o.id));
      if (v.scheduledAt && v.scheduledAt.getTime() !== current.scheduledAt?.getTime()) {
        scheduledIds.push(o.id);
        await tx.insert(orderEvents).values({ orderId: o.id, userId: s.user.id, type: "scheduled", data: { scheduledAt: v.scheduledAt.toISOString(), plannedMinutes: v.plannedMinutes } });
      }
      if (added.length) notify.push({ id: o.id, number: o.number });
      assignedCount++;
    }
  });
  for (const id of scheduledIds) await sendClientMail(id, "scheduled", s.user.id);
  if (notify.length > 0) {
    await notifyUsers(
      [v.assigneeId],
      {
        type: "assigned",
        title: `დაგენიშნათ ${notify.length} შეკვეთა`,
        body: notify
          .slice(0, 8)
          .map((o) => o.number)
          .join(", ") + (notify.length > 8 ? " ..." : ""),
        orderId: notify[0].id,
      },
      { excludeUserId: s.user.id },
    );
  }
  for (const p of ["/", "/schedule", "/orders", "/my"]) revalidatePath(p);
  for (const o of eligible) revalidatePath(`/orders/${o.id}`);
  return { ok: true, data: { assigned: assignedCount, skipped: ids.length - assignedCount } };
}
