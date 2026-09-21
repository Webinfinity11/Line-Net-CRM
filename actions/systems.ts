"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orders, services, systems } from "@/db/schema";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

const nameInput = z.string().trim().min(2, "დასახელება ძალიან მოკლეა").max(60);

/** A stable key derived from the name; Georgian names fall back to a timestamped key. */
function slugify(name: string) {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.length >= 2 ? ascii.slice(0, 40) : `sys-${Date.now().toString(36)}`;
}

async function requireAdmin() {
  const s = await getSession();
  return s && s.user.role === "admin" ? s.user : null;
}

function revalidateAll() {
  for (const p of ["/settings/services/categories", "/orders", "/settings/services", "/", "/reports", "/maintenance"]) revalidatePath(p);
}

export async function createSystem(fd: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = nameInput.safeParse(fd.get("name"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი დასახელება" };
  const name = parsed.data;
  const existing = await db.select({ slug: systems.slug, name: systems.name }).from(systems);
  if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "ასეთი კატეგორია უკვე არსებობს" };
  let slug = slugify(name);
  while (existing.some((s) => s.slug === slug)) slug = `${slug}-2`;
  await db.insert(systems).values({ slug, name, sort: (existing.length + 1) * 10 });
  revalidateAll();
  return { ok: true };
}

export async function renameSystem(slug: string, name: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const parsed = nameInput.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი დასახელება" };
  await db.update(systems).set({ name: parsed.data, updatedAt: new Date() }).where(eq(systems.slug, slug));
  revalidateAll();
  return { ok: true };
}

export async function setSystemActive(slug: string, active: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  await db.update(systems).set({ active, updatedAt: new Date() }).where(eq(systems.slug, slug));
  revalidateAll();
  return { ok: true };
}

/** Swap positions with the neighbour above or below. */
export async function moveSystem(slug: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const rows = await db.select().from(systems).orderBy(systems.sort, systems.slug);
  const i = rows.findIndex((r) => r.slug === slug);
  if (i === -1) return { ok: false, error: "კატეგორია ვერ მოიძებნა" };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true };
  await db.transaction(async (tx) => {
    // renumber the whole list so positions stay predictable
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    for (const [index, row] of next.entries()) {
      await tx.update(systems).set({ sort: (index + 1) * 10, updatedAt: new Date() }).where(eq(systems.slug, row.slug));
    }
  });
  revalidateAll();
  return { ok: true };
}

/** Only an unused system can be deleted; anything in use is hidden instead, so history stays intact. */
export async function deleteSystem(slug: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "მხოლოდ ადმინს შეუძლია" };
  const [o] = await db.select({ n: count() }).from(orders).where(eq(orders.systemType, slug));
  const [s] = await db.select({ n: count() }).from(services).where(eq(services.systemType, slug));
  const used = (o?.n ?? 0) + (s?.n ?? 0);
  if (used > 0) return { ok: false, error: `გამოიყენება ${used} ჩანაწერში. წაშლის ნაცვლად დამალეთ.` };
  await db.delete(systems).where(eq(systems.slug, slug));
  revalidateAll();
  return { ok: true };
}
