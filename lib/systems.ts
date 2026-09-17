import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { systems, type SystemType } from "@/db/schema";
import { SYSTEM_LABELS, SYSTEM_ORDER } from "@/lib/i18n";

export type SystemOption = { key: SystemType; name: string; color: string | null; sort: number; active: boolean };

/** The catalogue as the admin ordered it; falls back to the built-in labels on a fresh database. */
export const listSystems = cache(async (): Promise<SystemOption[]> => {
  const rows = await db.select().from(systems).orderBy(asc(systems.sort), asc(systems.slug));
  if (rows.length > 0) return rows.map((r) => ({ key: r.slug, name: r.name, color: r.color, sort: r.sort, active: r.active }));
  return SYSTEM_ORDER.map((key, i) => ({ key, name: SYSTEM_LABELS[key], color: null, sort: (i + 1) * 10, active: true }));
});

export const listActiveSystems = cache(async () => (await listSystems()).filter((s) => s.active));

/** key → label, for server components that render a system name. */
export const systemLabels = cache(async (): Promise<Record<string, string>> => {
  const rows = await listSystems();
  return Object.fromEntries(rows.map((r) => [r.key, r.name]));
});

export async function getSystem(key: SystemType) {
  const [row] = await db.select().from(systems).where(eq(systems.slug, key));
  return row ?? null;
}
