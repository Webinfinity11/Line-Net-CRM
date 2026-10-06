import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function claimManagerIfEmpty(tx: Tx, orderId: number, userId: string) {
  await tx.update(orders).set({ managerId: userId, managerAt: new Date() }).where(and(eq(orders.id, orderId), isNull(orders.managerId)));
}
