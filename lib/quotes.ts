import "server-only";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { quoteItems, quotes, type QuoteStatus } from "@/db/schema";

export type QuoteFilters = { q?: string; status?: QuoteStatus | "all" | "open"; clientId?: number };

const OPEN: QuoteStatus[] = ["draft", "sent"];

export async function listQuotes(f: QuoteFilters = {}) {
  const where = and(
    f.status && f.status !== "all" ? (f.status === "open" ? sql`${quotes.status} in ('draft','sent')` : eq(quotes.status, f.status)) : undefined,
    f.clientId ? eq(quotes.clientId, f.clientId) : undefined,
    f.q ? or(ilike(quotes.title, `%${f.q}%`), ilike(quotes.number, `%${f.q}%`)) : undefined,
  );
  return db.query.quotes.findMany({
    where,
    with: { client: { columns: { id: true, name: true } }, site: { columns: { id: true, name: true } }, items: true, order: { columns: { id: true, number: true } } },
    orderBy: [desc(quotes.createdAt)],
    limit: 200,
  });
}

export async function getQuote(id: number) {
  return db.query.quotes.findFirst({
    where: eq(quotes.id, id),
    with: {
      client: true,
      site: true,
      creator: { columns: { id: true, name: true } },
      order: { columns: { id: true, number: true } },
      items: { orderBy: [quoteItems.sort, quoteItems.id] },
    },
  });
}

export async function quoteCounts() {
  const rows = await db.select({ status: quotes.status, n: count() }).from(quotes).groupBy(quotes.status);
  const map = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<QuoteStatus, number>>;
  return { draft: map.draft ?? 0, sent: map.sent ?? 0, accepted: map.accepted ?? 0, declined: map.declined ?? 0, open: (map.draft ?? 0) + (map.sent ?? 0) };
}

export type QuoteRow = Awaited<ReturnType<typeof listQuotes>>[number];
export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;
export { OPEN as OPEN_QUOTE_STATUSES };
