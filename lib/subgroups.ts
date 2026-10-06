import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceSubgroups } from "@/db/schema";
import { compareNames } from "@/lib/order-utils";

export async function listSubgroups(systemSlug?: string) {
  const rows = await db.select().from(serviceSubgroups)
    .where(systemSlug ? eq(serviceSubgroups.systemSlug, systemSlug) : undefined);
  return rows.sort((a, b) => a.sort - b.sort || compareNames(a.name, b.name) || a.id - b.id);
}

export async function subgroupBelongs(id: number, systemSlug: string) {
  const [row] = await db.select({ id: serviceSubgroups.id }).from(serviceSubgroups)
    .where(and(eq(serviceSubgroups.id, id), eq(serviceSubgroups.systemSlug, systemSlug)));
  return !!row;
}
