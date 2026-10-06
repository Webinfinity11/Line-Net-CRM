"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { services, serviceSubgroups } from "@/db/schema";
import { getSession } from "@/lib/session";
import { systemSlug } from "@/lib/systems";
import { listSubgroups } from "@/lib/subgroups";
import type { ActionResult } from "./orders";

const nameInput = z.string().trim().min(2, "დასახელება ძალიან მოკლეა").max(200);
const idInput = z.number().int().positive();
const denied = { ok: false, error: "მხოლოდ ადმინს შეუძლია" } as const;
async function isAdmin() { return (await getSession())?.user.role === "admin"; }
function refresh() { revalidatePath("/settings/services"); }

export async function createSubgroup(slug: string, name: string): Promise<ActionResult> {
  if (!await isAdmin()) return denied;
  const parsed = await z.object({ systemSlug, name: nameInput }).safeParseAsync({ systemSlug: slug, name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const rows = await listSubgroups(slug);
  await db.insert(serviceSubgroups).values({ ...parsed.data, sort: Math.max(0, ...rows.map(r => r.sort)) + 10 });
  refresh();
  return { ok: true };
}

export async function renameSubgroup(id: number, name: string): Promise<ActionResult> {
  if (!await isAdmin()) return denied;
  const parsed = z.object({ id: idInput, name: nameInput }).safeParse({ id, name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.update(serviceSubgroups).set({ name: parsed.data.name }).where(eq(serviceSubgroups.id, id));
  refresh();
  return { ok: true };
}

export async function setSubgroupActive(id: number, active: boolean): Promise<ActionResult> {
  if (!await isAdmin()) return denied;
  if (!idInput.safeParse(id).success || typeof active !== "boolean") return { ok: false, error: "არასწორი მონაცემები" };
  await db.update(serviceSubgroups).set({ active }).where(eq(serviceSubgroups.id, id));
  refresh();
  return { ok: true };
}

export async function moveSubgroup(id: number, direction: "up" | "down"): Promise<ActionResult> {
  if (!await isAdmin()) return denied;
  if (!idInput.safeParse(id).success || !["up", "down"].includes(direction)) return { ok: false, error: "არასწორი მონაცემები" };
  const [row] = await db.select().from(serviceSubgroups).where(eq(serviceSubgroups.id, id));
  if (!row) return { ok: false, error: "ქვეჯგუფი ვერ მოიძებნა" };
  const rows = await listSubgroups(row.systemSlug);
  const i = rows.findIndex(r => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async tx => {
    for (const [index, entry] of rows.entries()) {
      await tx.update(serviceSubgroups).set({ sort: (index + 1) * 10 }).where(eq(serviceSubgroups.id, entry.id));
    }
  });
  refresh();
  return { ok: true };
}

export async function deleteSubgroup(id: number): Promise<ActionResult> {
  if (!await isAdmin()) return denied;
  if (!idInput.safeParse(id).success) return { ok: false, error: "არასწორი მონაცემები" };
  // Lock the parent so a concurrent service insert cannot pass its FK check during deletion.
  const result = await db.transaction(async tx => {
    const [row] = await tx.select().from(serviceSubgroups).where(eq(serviceSubgroups.id, id)).for("update");
    if (!row) return { ok: false, error: "ქვეჯგუფი ვერ მოიძებნა" } as const;
    const [usage] = await tx.select({ n: count() }).from(services).where(eq(services.subgroupId, id));
    if (usage.n) return { ok: false, error: "ჯერ სერვისები გადაიტანეთ" } as const;
    await tx.delete(serviceSubgroups).where(eq(serviceSubgroups.id, id));
    return { ok: true } as const;
  });
  if (result.ok) refresh();
  return result;
}
