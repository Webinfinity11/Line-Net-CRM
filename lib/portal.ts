import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, orders, sites, user } from "@/db/schema";
import { requireUser, type SessionUser } from "@/lib/session";

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
  return db.select({ id: sites.id, name: sites.name, address: sites.address, contactName: sites.contactName, contactPhone: sites.contactPhone }).from(sites).where(eq(sites.clientId, clientId)).orderBy(asc(sites.name));
}

/** Everything ordered for the company, whoever entered it. No money, no internal notes, no people. */
export async function listPortalOrders(clientId: number) {
  return db.query.orders.findMany({
    where: eq(orders.clientId, clientId),
    columns: { id: true, number: true, title: true, description: true, status: true, triaged: true, priority: true, systemType: true, address: true, scheduledAt: true, completedAt: true, createdAt: true },
    with: { site: { columns: { name: true, address: true } } },
    orderBy: [desc(orders.createdAt)],
    limit: 200,
  });
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
