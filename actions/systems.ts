"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { systemTypeEnum, systems } from "@/db/schema";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

const input = z.object({
  key: z.enum(systemTypeEnum.enumValues),
  name: z.string().trim().min(2, "დასახელება ძალიან მოკლეა").max(60),
  sort: z.coerce.number().int().min(0).max(9999),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

async function requireAdmin() {
  const s = await getSession();
  return s && s.user.role === "admin" ? s.user : null;
}

function revalidateAll() {
  for (const p of ["/settings/systems", "/orders", "/settings/services", "/", "/reports"]) revalidatePath(p);
}

/** Rename, reorder or hide a system. The key never changes: existing orders keep pointing at it. */
export async function updateSystem(fd: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = input.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  await db
    .insert(systems)
    .values({ key: v.key, name: v.name, sort: v.sort, active: v.active, updatedAt: new Date() })
    .onConflictDoUpdate({ target: systems.key, set: { name: v.name, sort: v.sort, active: v.active, updatedAt: new Date() } });
  revalidateAll();
  return { ok: true };
}

export async function setSystemActive(key: string, active: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = z.enum(systemTypeEnum.enumValues).safeParse(key);
  if (!parsed.success) return { ok: false, error: "სისტემა ვერ მოიძებნა" };
  await db.update(systems).set({ active, updatedAt: new Date() }).where(eq(systems.key, parsed.data));
  revalidateAll();
  return { ok: true };
}
