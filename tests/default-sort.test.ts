import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: { query: { orders: { findMany: mocks.findMany } } } }));
import { listMyOrders, listOrders, type OrderSort } from "@/lib/orders";

beforeEach(() => vi.resetAllMocks());

function ordering() {
  const query = mocks.findMany.mock.lastCall![0];
  return query.orderBy.map((part: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(part).sql);
}

describe("order list sorting", () => {
  it("uses only newest first for orders, inbox and the executor's list", async () => {
    await listOrders();
    expect(ordering()).toEqual(['"orders"."created_at" desc']);
    await listOrders({ inbox: true });
    expect(ordering()).toEqual(['"orders"."created_at" desc']);
    await listMyOrders("executor-id");
    expect(ordering()).toEqual(['"orders"."created_at" desc']);
  });

  it.each<[OrderSort, string[]]>([
    ["created", ['"orders"."created_at" desc']],
    ["due", ['"orders"."due_date" asc nulls last', '"orders"."created_at" desc']],
    ["priority", ['"orders"."priority" desc', '"orders"."due_date" asc nulls last']],
    ["amount", ['"orders"."amount" desc nulls last', '"orders"."created_at" desc']],
  ])("preserves explicit %s sorting", async (sort, expected) => {
    await listOrders({}, { sort });
    expect(ordering()).toEqual(expected);
  });
});
