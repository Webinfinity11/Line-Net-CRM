import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { quoteItems, quotes } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The stored total mirrors the lines, so lists and reports never recompute it. */
export async function recomputeQuoteTotal(tx: Tx, quoteId: number) {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${quoteItems.quantity} * ${quoteItems.unitPrice}), 0)` })
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));
  await tx.update(quotes).set({ total: row?.total ?? "0", updatedAt: new Date() }).where(eq(quotes.id, quoteId));
}
