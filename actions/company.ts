"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getSession } from "@/lib/session";
import { COMPANY_FIELDS } from "@/lib/company";
import type { ActionResult } from "./orders";
export async function saveCompany(fd: FormData): Promise<ActionResult> {
 const s = await getSession();
 if (!s || s.user.role !== "admin") return { ok: false, error: "არ გაქვთ უფლება" };
 const values = Object.keys(COMPANY_FIELDS).map(key => ({ key, value: String(fd.get(key) ?? "").trim() }));
 if (values.some(v => v.value.length > 500)) return { ok: false, error: "მონაცემი ძალიან გრძელია" };
 await db.transaction(async tx => { for (const v of values) await tx.insert(appSettings).values(v).onConflictDoUpdate({ target: appSettings.key, set: { value: v.value } }); });
 revalidatePath("/settings/company"); revalidatePath("/orders", "layout"); return { ok: true };
}

export async function setClientEmailsEnabled(enabled: boolean): Promise<ActionResult> {
 const s = await getSession();
 if (!s || s.user.role !== "admin") return { ok: false, error: "არ გაქვთ უფლება" };
 if (typeof enabled !== "boolean") return { ok: false, error: "არასწორი მნიშვნელობა" };
 await db.insert(appSettings).values({ key: "client_emails_enabled", value: enabled }).onConflictDoUpdate({ target: appSettings.key, set: { value: enabled } });
 revalidatePath("/settings/company"); revalidatePath("/orders", "layout"); return { ok: true };
}
