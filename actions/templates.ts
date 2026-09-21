"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

const hoursInput = z.coerce.number().int().min(1).max(24);

/** Working hours per day: the norm the schedule measures workload against. */
export async function setWorkHoursPerDay(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = hoursInput.safeParse(fd.get("hours"));
  if (!parsed.success) return { ok: false, error: "საათების რაოდენობა უნდა იყოს 1-დან 24-მდე" };
  const value = String(parsed.data);
  await db
    .insert(appSettings)
    .values({ key: "work_hours_per_day", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  revalidatePath("/schedule");
  return { ok: true };
}
