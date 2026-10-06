import "server-only";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, orders, sites, user } from "@/db/schema";
import { requireUser, type SessionUser } from "@/lib/session";
import { compareNames } from "@/lib/order-utils";

export type PortalCompany = { id: number; name: string };

/** Only the first acceptance of a portal request notifies its client. */
export function shouldNotifyPortalAcceptance(source: string, wasTriaged: boolean, triaged: boolean): boolean {
  return source === "portal" && !wasTriaged && triaged;
}

/** The company a client login orders for; null when an admin has not linked one yet. */
export async function portalCompanyOf(userId: string): Promise<PortalCompany | null> {
  const [row] = await db
    .select({ id: clients.id, name: clients.name })
    .from(user)
    .innerJoin(clients, eq(clients.id, user.clientId))
    .where(eq(user.id, userId));
  return row ?? null;
}

/** Portal pages only: staff and technicians are sent to their own home. */
export async function requirePortalUser(): Promise<{ me: SessionUser; company: PortalCompany | null }> {
  const me = await requireUser(["client"]);
  return { me, company: await portalCompanyOf(me.id) };
}

export async function listPortalSites(clientId: number) {
  const rows = await db.select({ id: sites.id, name: sites.name, address: sites.address, contactName: sites.contactName, contactPhone: sites.contactPhone }).from(sites).where(eq(sites.clientId, clientId)).orderBy(asc(sites.name));
  return rows.sort((a, b) => compareNames(a.name, b.name));
}

/** Everything ordered for the company, whoever entered it. No money, no internal notes, no people. */
export async function listPortalOrders(clientId: number, filters: { q?: string; siteId?: number } = {}) {
  const query = filters.q?.trim();
  const pattern = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return db.query.orders.findMany({
    where: and(
      eq(orders.clientId, clientId),
      filters.siteId ? eq(orders.siteId, filters.siteId) : undefined,
      pattern ? or(
        ilike(orders.number, pattern), ilike(orders.title, pattern), ilike(orders.address, pattern),
        inArray(orders.siteId, db.select({ id: sites.id }).from(sites).where(and(
          eq(sites.clientId, clientId), or(ilike(sites.name, pattern), ilike(sites.address, pattern)),
        ))),
      ) : undefined,
    ),
    columns: { id: true, number: true, title: true, description: true, status: true, triaged: true, priority: true, systemType: true, address: true, scheduledAt: true, completedAt: true, createdAt: true },
    with: { site: { columns: { name: true, address: true } } },
    orderBy: [desc(orders.createdAt)],
    limit: 300,
  });
}

/** Explicit client projection: prices, internal notes and other companies never leave the server. */
export async function getPortalOrder(id: number, clientId: number) {
  const row = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.clientId, clientId)),
    columns: { id: true, number: true, title: true, description: true, address: true, status: true, triaged: true, systemType: true, createdAt: true, scheduledAt: true, completedAt: true, closedAt: true },
    with: {
      site: { columns: { id: true, name: true, address: true } },
      items: { columns: { id: true, name: true, unit: true, quantity: true }, orderBy: (items, { asc }) => [asc(items.id)] },
      assignees: {
        columns: { doneNote: true, doneAt: true },
        where: (assignees, { isNotNull }) => isNotNull(assignees.doneNote),
        with: { user: { columns: { name: true } } },
        orderBy: (assignees, { desc }) => [desc(assignees.doneAt)],
      },
      attachments: {
        columns: { id: true, fileName: true, mimeType: true, createdAt: true },
        where: (attachments, { like }) => like(attachments.mimeType, "image/%"),
        orderBy: (attachments, { desc }) => [desc(attachments.createdAt)],
      },
    },
  });
  return row ?? null;
}

export type PortalOrder = Awaited<ReturnType<typeof listPortalOrders>>[number];

/** Client logins that order for this company, for the client card. */
export async function listPortalLogins(clientId: number) {
  return db
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned })
    .from(user)
    .where(and(eq(user.role, "client"), eq(user.clientId, clientId)))
    .orderBy(asc(user.name));
}

export type PortalSite = Awaited<ReturnType<typeof listPortalSites>>[number];
