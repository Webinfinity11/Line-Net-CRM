import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mock = vi.hoisted(() => ({ many: vi.fn().mockResolvedValue([]) }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: { query: { orders: { findMany: mock.many } } } }));
import { listOrders } from "@/lib/orders";

describe("unpaid order filter", () => {
  it("includes completed orders and keeps other selected filters", async () => {
    await listOrders({ payment: "unpaid", status: "all", manager: "owner", q: "router" });
    const query = new PgDialect().sqlToQuery(mock.many.mock.calls[0][0].where);
    expect(query.sql).toContain('"triaged" =');
    expect(query.sql).toContain('"amount" is not null');
    expect(query.sql).toContain('"amount" - "orders"."paid_total" > 0');
    expect(query.params).toContain("cancelled");
    expect(query.params).toContain("owner");
    expect(query.params).toContain("%router%");
    expect(query.params).not.toContain("done");
    expect(query.params).not.toContain("closed");
  });
});
