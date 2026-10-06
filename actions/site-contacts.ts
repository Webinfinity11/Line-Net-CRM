"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { siteContacts, sites, user } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";
const input = z.object({ name: z.string().trim().min(1).max(200), position: z.string().trim().max(200), phone: z.string().trim().max(80), email: z.union([z.email(), z.literal("")]), receivesEmail: z.boolean() });
export async function saveSiteContact(siteId: number, id: number | null, fd: FormData): Promise<ActionResult> {
 const s = await getSession();
 if (!s || (!isStaff(s.user.role) && s.user.role !== "client")) return { ok: false, error: "არ გაქვთ უფლება" };
 const v = input.safeParse({ name: fd.get("name"), position: fd.get("position") ?? "", phone: fd.get("phone") ?? "", email: fd.get("email") ?? "", receivesEmail: fd.get("receivesEmail") === "on" });
 if (!v.success) return { ok: false, error: "შეამოწმეთ სახელი და ელფოსტა" };
 if (v.data.receivesEmail && !v.data.email) return { ok: false, error: "მეილის მიმღებს ელფოსტა უნდა მიუთითოთ" };
 const result = await db.transaction(async tx => {
  const account = await tx.query.user.findFirst({ where: eq(user.id, s.user.id) });
  const site = await tx.query.sites.findFirst({ where: and(eq(sites.id, siteId), s.user.role === "client" ? eq(sites.clientId, account?.clientId ?? -1) : undefined) });
  if (!site) return null;
  const values = { ...v.data, email: v.data.email || null, position: v.data.position || null, phone: v.data.phone || null };
  if (id !== null) {
   const rows = await tx.update(siteContacts).set(values).where(and(eq(siteContacts.id, id), eq(siteContacts.siteId, site.id))).returning();
   if (!rows.length) return null;
  } else await tx.insert(siteContacts).values({ ...values, siteId: site.id });
  return site.clientId;
 });
 if (result === null) return { ok: false, error: "კონტაქტი ან ობიექტი ვერ მოიძებნა" };
 revalidatePath(`/clients/${result}`); revalidatePath("/portal/sites"); return { ok: true };
}
export async function deleteSiteContact(id: number): Promise<ActionResult> {
 const s = await getSession();
 if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
 const [row] = await db.delete(siteContacts).where(eq(siteContacts.id, id)).returning();
 if (!row) return { ok: false, error: "კონტაქტი ვერ მოიძებნა" };
 revalidatePath("/clients", "layout"); revalidatePath("/portal/sites"); return { ok: true };
}
