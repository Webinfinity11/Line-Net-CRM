import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), transaction: vi.fn(), sync: vi.fn(), claim: vi.fn(), notify: vi.fn() }));
vi.mock("server-only", () => ({})); vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/session", () => ({ getSession: m.session, isStaff: (r: string) => ["admin", "manager"].includes(r) }));
vi.mock("@/lib/assignees", () => ({ syncAssignees: m.sync }));
vi.mock("@/lib/order-team", () => ({ claimManagerIfEmpty: m.claim }));
vi.mock("@/lib/notify", () => ({ notifyUsers: m.notify, staffUserIds: async () => [] }));
import { decideRequest } from "@/actions/requests";
import { orders, orderRequests } from "@/db/schema";
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue({ user: { id: "manager", role: "manager" } }); });
function transaction(status = "new", pending = true) {
 const request = { id: 7, orderId: 4, userId: "executor", requestedBy: "requester", status: "pending" };
 const requestRead = vi.fn().mockResolvedValueOnce(request).mockResolvedValueOnce(pending ? request : undefined);
 const patches: { table: unknown; value: unknown }[] = [];
 let selects = 0;
 const tx = {
  query: { orderRequests: { findFirst: requestRead }, user: { findFirst: async () => ({ name: "გიორგი" }) } },
  select: () => ({ from: () => ({ where: () => ++selects === 1 ? { for: async () => [{ id: 4, status }] } : Promise.resolve([{ userId: "colleague" }]) }) }),
  update: (table: unknown) => ({ set: (value: unknown) => { patches.push({ table, value }); return { where: async () => [] }; } }),
  insert: () => ({ values: async () => [] }),
 };
 m.transaction.mockImplementation(async cb => cb(tx)); return patches;
}
describe("assignment request decisions", () => {
 it("approves through the shared assignee logic and moves new to assigned", async () => {
  const patches = transaction(); expect((await decideRequest(7, true)).ok).toBe(true);
  expect(m.sync).toHaveBeenCalledWith(expect.anything(), 4, ["colleague"], ["colleague", "executor"], "manager", false);
  expect(patches.find(p => p.table === orders)?.value).toMatchObject({ status: "assigned" });
  expect(patches.find(p => p.table === orderRequests)?.value).toMatchObject({ status: "approved", decidedBy: "manager" });
  expect(m.notify).toHaveBeenCalledWith(["executor", "requester"], expect.objectContaining({ type: "assigned" }));
 });
 it("declines without changing assignees", async () => { const patches = transaction(); expect((await decideRequest(7, false)).ok).toBe(true); expect(m.sync).not.toHaveBeenCalled(); expect(patches.find(p => p.table === orderRequests)?.value).toMatchObject({ status: "declined" }); });
 it("does not approve a decided request twice", async () => { transaction("assigned", false); expect((await decideRequest(7, true)).ok).toBe(false); expect(m.sync).not.toHaveBeenCalled(); expect(m.notify).not.toHaveBeenCalled(); });
 it("does not change a closed order", async () => { transaction("closed"); expect((await decideRequest(7, true)).ok).toBe(false); expect(m.sync).not.toHaveBeenCalled(); });
 it("rejects executor decisions before any database work", async () => { m.session.mockResolvedValue({ user: { role: "executor" } }); expect((await decideRequest(7, true)).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled(); });
});
