import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), transaction: vi.fn(), recompute: vi.fn(), set: vi.fn(), insert: vi.fn() }));
vi.mock("server-only", () => ({})); vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: m.select, transaction: m.transaction } }));
vi.mock("@/lib/session", () => ({ getSession: m.session, isStaff: (r: string) => ["admin", "manager"].includes(r) }));
vi.mock("@/lib/order-items", () => ({ recomputeOrderAmount: m.recompute }));
vi.mock("@/lib/systems", async () => { const { z } = await import("zod"); return { systemSlug: z.string() }; });
vi.mock("@/lib/order-team", () => ({ claimManagerIfEmpty: vi.fn() }));
import { addOrderItem, removeOrderItem, updateOrderItem } from "@/actions/services";
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue({ user: { id: "a", role: "executor" } }); });
function setup(creator: string, status = "in_progress", assigned = true) {
 m.select.mockReturnValue({ from: () => ({ where: async () => [{ orderId: 1, createdBy: creator, status }] }) });
 const mutation = vi.fn();
 m.set.mockReturnValue({ where: mutation });
 m.transaction.mockImplementation(async cb => cb({
  select: () => ({ from: () => ({ where: () => ({ for: async () => [{ status }] }) }) }),
  query: { orderAssignees: { findFirst: async () => assigned ? { userId: "a" } : null } },
  delete: () => ({ where: mutation }), update: () => ({ set: m.set }), insert: () => ({ values: m.insert }),
 })); return mutation;
}
describe("executor service ownership", () => {
 it.each(["b", "manager"])("cannot remove %s's line", async creator => { const mutation = setup(creator); expect((await removeOrderItem(5)).ok).toBe(false); expect(mutation).not.toHaveBeenCalled(); expect(m.recompute).not.toHaveBeenCalled(); });
 it("cannot edit another person's price", async () => { const mutation = setup("b"); expect((await updateOrderItem(5, 1, 0)).ok).toBe(false); expect(mutation).not.toHaveBeenCalled(); });
 it.each(["done", "closed", "cancelled"])("cannot change own lines when %s", async status => { const mutation = setup("a", status); expect((await removeOrderItem(5)).ok).toBe(false); expect(mutation).not.toHaveBeenCalled(); });
 it("cannot change a line after being unassigned", async () => { const mutation = setup("a", "in_progress", false); expect((await removeOrderItem(5)).ok).toBe(false); expect(mutation).not.toHaveBeenCalled(); });
 it("can change own active line and recomputes the order total", async () => { const mutation = setup("a"); expect((await updateOrderItem(5, 12.5, 3.2)).ok).toBe(true); expect(mutation).toHaveBeenCalled(); expect(m.recompute).toHaveBeenCalledWith(expect.anything(), 1); });
});


describe("service price permissions", () => {
 it.each([undefined, null, 0, 150, -5, NaN])("executor updates quantity without writing submitted price %s", async price => {
  setup("a");
  expect((await updateOrderItem(5, 2, price)).ok).toBe(true);
  expect(m.set).toHaveBeenCalledWith({ quantity: "2" });
  expect(m.set.mock.calls[0][0]).not.toHaveProperty("unitPrice");
  expect(m.recompute).toHaveBeenCalledWith(expect.anything(), 1);
 });
 it.each(["admin", "manager"])("%s can update the price", async role => {
  setup("a"); m.session.mockResolvedValue({ user: { id: "staff", role } });
  expect((await updateOrderItem(5, 2, 150)).ok).toBe(true);
  expect(m.set).toHaveBeenCalledWith({ quantity: "2", unitPrice: "150" });
 });
 it.each([undefined, null])("staff preserves price when %s is submitted", async price => {
  setup("a"); m.session.mockResolvedValue({ user: { id: "staff", role: "manager" } });
  expect((await updateOrderItem(5, 2, price)).ok).toBe(true);
  expect(m.set).toHaveBeenCalledWith({ quantity: "2" });
 });
 it.each([
  ["executor", true, undefined, "125.50"],
  ["executor", true, "999", "125.50"],
  ["executor", true, "invalid", "125.50"],
  ["executor", false, undefined, "0"],
  ["executor", false, "999", "0"],
  ["manager", true, undefined, "125.50"],
  ["manager", true, "150", "150"],
  ["manager", true, "0", "0"],
  ["manager", false, undefined, "0"],
  ["manager", false, "150", "150"],
 ])("%s adds catalogue=%s submitted=%s with price %s", async (role, catalogue, submitted, expected) => {
  setup("a"); m.session.mockResolvedValue({ user: { id: "a", role } });
  if (catalogue) {
   m.select.mockReturnValueOnce({ from: () => ({ where: async () => [{ status: "in_progress" }] }) })
    .mockReturnValueOnce({ from: () => ({ where: async () => [{ name: "Service", unit: "ცალი", price: "125.50" }] }) });
  }
  const fd = new FormData();
  fd.set("quantity", "2");
  if (catalogue) fd.set("serviceId", "3");
  else fd.set("name", "Manual line");
  if (submitted !== undefined) fd.set("unitPrice", submitted);
  expect((await addOrderItem(1, fd)).ok).toBe(true);
  expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ quantity: "2", unitPrice: expected }));
  expect(m.recompute).toHaveBeenCalledWith(expect.anything(), 1);
 });
});
