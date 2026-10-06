"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { notifications, user } from "@/db/schema";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

export async function markNotificationRead(id: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, s.user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, s.user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Opening an order's conversation clears that order's comment notifications for the reader. */
export async function markOrderCommentsRead(orderId: number): Promise<ActionResult<{ marked: number }>> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return { ok: false, error: "შეკვეთა ვერ მოიძებნა" };
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, s.user.id), eq(notifications.orderId, orderId), eq(notifications.type, "comment"), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  if (rows.length > 0) revalidatePath("/", "layout");
  return { ok: true, data: { marked: rows.length } };
}

const profileInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(120),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "ავტორიზაცია საჭიროა" };
  const parsed = profileInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  await db.update(user).set({ name: parsed.data.name, phone: parsed.data.phone || null, updatedAt: new Date() }).where(eq(user.id, s.user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
