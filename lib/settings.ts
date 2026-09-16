import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export const DEFAULT_WORK_HOURS = 8;

export async function getWorkHoursPerDay(): Promise<number> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "work_hours_per_day"));
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WORK_HOURS;
}
