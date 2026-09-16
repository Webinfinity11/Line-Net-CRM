"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { siteEquipment, sites, systemTypeEnum } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const input = z.object({
  siteId: z.coerce.number().int().positive(),
  systemType: z.preprocess(emptyToNull, z.enum(systemTypeEnum.enumValues).nullable()),
  name: z.string().trim().min(1, "დასახელება სავალდებულოა").max(200),
  model: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  serial: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  quantity: z.coerce.number().int().min(1).max(100000).default(1),
  installedAt: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  warrantyUntil: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  orderId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

async function revalidateSite(siteId: number) {
  const [site] = await db.select({ clientId: sites.clientId }).from(sites).where(eq(sites.id, siteId));
  if (site) revalidatePath(`/clients/${site.clientId}`);
}

export async function createEquipment(fd: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const [row] = await db.insert(siteEquipment).values(parsed.data).returning({ id: siteEquipment.id });
  await revalidateSite(parsed.data.siteId);
  return { ok: true, data: { id: row.id } };
}

export async function updateEquipment(id: number, fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  await db.update(siteEquipment).set(parsed.data).where(eq(siteEquipment.id, id));
  await revalidateSite(parsed.data.siteId);
  return { ok: true };
}

export async function deleteEquipment(id: number): Promise<ActionResult> {
  await requireStaff();
  const [row] = await db.select({ siteId: siteEquipment.siteId }).from(siteEquipment).where(eq(siteEquipment.id, id));
  if (!row) return { ok: false, error: "ჩანაწერი ვერ მოიძებნა" };
  await db.delete(siteEquipment).where(eq(siteEquipment.id, id));
  await revalidateSite(row.siteId);
  return { ok: true };
}
