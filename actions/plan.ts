"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderAssignees, orderEvents, orders } from "@/db/schema";
import { notifyUsers } from "@/lib/notify";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const input = z.object({
  scheduledAt: z.coerce.date(),
  plannedMinutes: z.coerce.number().int().min(15).max(1440).default(120),
  assigneeId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().nullable()),
});

/** Quick planning from the schedule page: time, duration and optionally one executor. */
export async function quickSchedule(orderId: number, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { assignees: true } });
  if (!existing) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  if (existing.status === "closed" || existing.status === "cancelled") return { ok: false, error: "დახურული/გაუქმებული შეკვეთა არ იგეგმება" };

  const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(v.scheduledAt);
  let notify: string | null = null;
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        scheduledAt: v.scheduledAt,
        plannedMinutes: v.plannedMinutes,
        dueDate: existing.dueDate ?? dueDate,
        status: existing.status === "new" && (v.assigneeId || existing.assignees.length) ? "assigned" : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "scheduled", data: { scheduledAt: v.scheduledAt.toISOString(), plannedMinutes: v.plannedMinutes } });
    if (v.assigneeId && !existing.assignees.some((a) => a.userId === v.assigneeId)) {
      await tx.insert(orderAssignees).values({ orderId, userId: v.assigneeId, assignedBy: s.user.id });
      await tx.insert(orderEvents).values({ orderId, userId: s.user.id, type: "assigned", data: { users: [v.assigneeId] } });
      notify = v.assigneeId;
    }
  });
  if (notify) await notifyUsers([notify], { type: "assigned", title: `დაგენიშნათ შეკვეთა ${existing.number}`, body: existing.title, orderId }, { excludeUserId: s.user.id });
  revalidatePath("/schedule");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
  return { ok: true };
}
