"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appSettings, checklistTemplates, systemTypeEnum } from "@/db/schema";
import { normalizeItems } from "@/lib/checklists";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const input = z.object({
  systemType: z.enum(systemTypeEnum.enumValues),
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(200),
  isDefault: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  requiresPhoto: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  /** one item per line; a leading "*" marks it required */
  itemsText: z.string().max(20000).default(""),
});

function parseItems(text: string) {
  return normalizeItems(
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith("*") ? { label: l.slice(1).trim(), required: true } : { label: l, required: false })),
  );
}

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

function fd2obj(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

async function clearOtherDefaults(systemType: (typeof systemTypeEnum.enumValues)[number], keepId: number) {
  await db.update(checklistTemplates).set({ isDefault: false }).where(and(eq(checklistTemplates.systemType, systemType), ne(checklistTemplates.id, keepId)));
}

export async function createTemplate(fd: FormData): Promise<ActionResult<{ id: number }>> {
  try {
    await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = input.safeParse(fd2obj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const items = parseItems(v.itemsText);
  if (items.length === 0) return { ok: false, error: "დაამატეთ მინიმუმ ერთი პუნქტი" };
  const [row] = await db.insert(checklistTemplates).values({ systemType: v.systemType, name: v.name, items, isDefault: v.isDefault, requiresPhoto: v.requiresPhoto }).returning({ id: checklistTemplates.id });
  if (v.isDefault) await clearOtherDefaults(v.systemType, row.id);
  revalidatePath("/settings/checklists");
  return { ok: true, data: { id: row.id } };
}

export async function updateTemplate(id: number, fd: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = input.safeParse(fd2obj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const items = parseItems(v.itemsText);
  if (items.length === 0) return { ok: false, error: "დაამატეთ მინიმუმ ერთი პუნქტი" };
  await db.update(checklistTemplates).set({ systemType: v.systemType, name: v.name, items, isDefault: v.isDefault, requiresPhoto: v.requiresPhoto }).where(eq(checklistTemplates.id, id));
  if (v.isDefault) await clearOtherDefaults(v.systemType, id);
  revalidatePath("/settings/checklists");
  return { ok: true };
}

export async function deleteTemplate(id: number): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია წაშლა" };
  await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
  revalidatePath("/settings/checklists");
  return { ok: true };
}

const hoursInput = z.coerce.number().min(1).max(24);

export async function setWorkHoursPerDay(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s || s.user.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = hoursInput.safeParse(fd.get("hours"));
  if (!parsed.success) return { ok: false, error: "საათები 1-დან 24-მდე" };
  await db
    .insert(appSettings)
    .values({ key: "work_hours_per_day", value: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: parsed.data, updatedAt: new Date() } });
  revalidatePath("/schedule");
  revalidatePath("/settings/checklists");
  return { ok: true };
}
