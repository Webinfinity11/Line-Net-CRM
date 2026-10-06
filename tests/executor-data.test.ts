import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), many: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: { query: { orders: { findFirst: m.find, findMany: m.many } } } }));
import { getOrderForUser, listOrders, listMyOrders } from "@/lib/orders";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SessionUser } from "@/lib/session";
const executor = { id: "a", role: "executor" } as SessionUser;
beforeEach(() => vi.resetAllMocks());
describe("executor server data boundary", () => {
 it("hides amounts and prices and removes receipts, material costs and payment events", async () => {
  m.find.mockResolvedValue({ assignees: [{ userId: "a" }], amount: "100", paidTotal: "75", paymentStatus: "partial", payments: [{ amount: "75" }], materials: [{ unitCost: "40" }], items: [{ unitPrice: "100" }], events: [{ type: "payment_added" }, { type: "client_email" }, { type: "assigned" }] });
  const result = await getOrderForUser(1, executor);
  expect(result?.order).toMatchObject({ amount: null, items: [{ unitPrice: null }], materials: [{ unitCost: null }], events: [{ type: "assigned" }] });
  expect(result?.financeVisible).toBe(false);
  for (const key of ["paidTotal", "paidAt", "paymentStatus", "paymentReviewNeeded", "payments"]) expect(result?.order).not.toHaveProperty(key);
 });
 it("denies order detail to unassigned executors and client logins", async () => {
  m.find.mockResolvedValue({ assignees: [{ userId: "other" }] }); expect(await getOrderForUser(1, executor)).toBeNull();
  m.find.mockResolvedValue({ assignees: [{ userId: "a" }] }); expect(await getOrderForUser(1, { ...executor, role: "client" })).toBeNull();
 });
 it("defaults list queries to newest first and preserves explicit sorting", async () => {
  await listOrders(); let query = m.many.mock.calls[0][0];
  expect(new PgDialect().sqlToQuery(query.orderBy[0]).sql).toContain('"created_at" desc');
  await listOrders({}, { sort: "created" }); query = m.many.mock.calls[1][0]; expect(new PgDialect().sqlToQuery(query.orderBy[0]).sql).toContain('"created_at" desc');
  await listMyOrders("a"); query = m.many.mock.calls[2][0]; expect(query.columns.amount).toBeUndefined(); expect(query.columns.paidTotal).toBeUndefined(); expect(new PgDialect().sqlToQuery(query.orderBy[0]).sql).toContain('"created_at" desc');
 });
});
