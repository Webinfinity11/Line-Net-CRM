import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { orderAssignees, orderComments } from "@/db/schema";
import { isStaff, type SessionUser } from "@/lib/session";

export type OrderComment = { id: number; body: string; createdAt: Date; user: { id: string; name: string; image: string | null } | null };

/** Staff see every order's comments; everyone else only the orders they are assigned to. */
export async function canAccessOrderComments(orderId: number, u: SessionUser): Promise<boolean> {
  if (isStaff(u.role)) return true;
  const [a] = await db
    .select({ orderId: orderAssignees.orderId })
    .from(orderAssignees)
    .where(and(eq(orderAssignees.orderId, orderId), eq(orderAssignees.userId, u.id)))
    .limit(1);
  return Boolean(a);
}

export async function listCommentsSince(orderId: number, sinceId: number): Promise<OrderComment[]> {
  return db.query.orderComments.findMany({
    columns: { id: true, body: true, createdAt: true },
    where: and(eq(orderComments.orderId, orderId), gt(orderComments.id, sinceId)),
    with: { user: { columns: { id: true, name: true, image: true } } },
    orderBy: [asc(orderComments.id)],
    limit: 100,
  });
}
