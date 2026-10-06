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

export async function getCompanySettings() {
 const rows = await db.select().from(appSettings);
 const { COMPANY_FIELDS } = await import("./company");
 return Object.fromEntries(Object.keys(COMPANY_FIELDS).map(k => [k, String(rows.find(r => r.key === k)?.value ?? "")])) as import("./company").CompanySettings;
}
export async function clientEmailsEnabled() {
 const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "client_emails_enabled") });
 return row?.value === true || row?.value === "true";
}
