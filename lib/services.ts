import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, services } from "@/db/schema";

/** Catalogue for the admin screen; `q` filters by name. */
export async function listServices(opts: { q?: string; includeInactive?: boolean } = {}) {
  const where = and(
    opts.includeInactive ? undefined : eq(services.active, true),
    opts.q ? or(ilike(services.name, `%${opts.q}%`), ilike(services.description, `%${opts.q}%`)) : undefined,
  );
  return db.select().from(services).where(where).orderBy(asc(services.sort), asc(services.name));
}

/** Compact list for the picker on an order. */
export async function listActiveServices() {
  return db
    .select({ id: services.id, name: services.name, unit: services.unit, price: services.price, systemType: services.systemType })
    .from(services)
    .where(eq(services.active, true))
    .orderBy(asc(services.sort), asc(services.name));
}

export async function countServiceUsage(serviceId: number) {
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(orderItems).where(eq(orderItems.serviceId, serviceId));
  return row?.n ?? 0;
}
