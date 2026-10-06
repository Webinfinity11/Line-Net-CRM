import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), transaction: vi.fn(), notify: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({})); vi.mock("next/cache", () => ({ revalidatePath: vi.fn() })); vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/db", () => ({ db: { query: { orders: { findFirst: m.find } }, transaction: m.transaction, select: m.select } }));
vi.mock("@/lib/session", () => ({ getSession: m.session, isStaff: (r: string) => ["admin", "manager"].includes(r) }));
vi.mock("@/lib/notify", () => ({ notifyUsers: m.notify, staffUserIds: async () => ["manager"] }));
vi.mock("@/lib/systems", async () => { const { z } = await import("zod"); return { systemSlug: z.string() }; });
vi.mock("@/lib/portal", () => ({ shouldNotifyPortalAcceptance: vi.fn() }));
vi.mock("@/lib/client-mail", () => ({ sendClientMail: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteStoredFile: vi.fn(), saveFile: vi.fn() }));
vi.mock("@/lib/order-items", () => ({ recomputeOrderAmount: vi.fn() }));
vi.mock("@/lib/payments", () => ({ recomputeOrderPayments: vi.fn() }));
import { revalidatePath } from "next/cache";
import { completeOrder, setStatus } from "@/actions/orders";
import { orderAssignees, orderAttachments, orders, orderVisits } from "@/db/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue({ user: { id: "a", name: "გიორგი", role: "executor" } }); });
function setup(otherDone: boolean, mineDone = false, photos = [{ mimeType: "image/jpeg", uploadedBy: "a" }], checklist: { label: string; required: boolean; done: boolean }[] = []) {
 const people = [{ userId: "a", doneAt: mineDone ? new Date() : null, doneNote: null as string | null, user: { name: "გიორგი" } }, { userId: "b", doneAt: otherDone ? new Date() : null, doneNote: otherDone ? "კაბელი გაყვანილია" : null, user: { name: "ლევანი" } }];
 const order = { id: 4, number: "LN-4", status: "in_progress", assignees: people, warrantyMonths: 0, warrantyUntil: null, managerId: "manager", clientId: 49, site: { name: "ვერე" } };
 m.find.mockResolvedValue(order);
 m.select.mockImplementation(() => ({ from: () => ({ where: async (where: SQL) => {
  const params = new PgDialect().sqlToQuery(where).params;
  if (params.includes("client")) {
   expect(params).toEqual(["client", 49, false]);
   return [{ id: "client" }];
  }
  expect(params).toEqual(["admin", false]);
  return [{ id: "admin" }];
 } }) }));
 const writes: { table: unknown; patch: Record<string, unknown>; where?: SQL }[] = [];
 m.transaction.mockImplementation(async cb => cb({
  select: () => ({ from: (table: unknown) => ({ where: () => table === orders ? ({ for: async () => [order] }) : Promise.resolve(table === orderAttachments ? photos : checklist) }) }),
  query: { orderAssignees: { findMany: async () => people } },
  update: (table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async (where: SQL) => { writes.push({ table, patch, where }); } }) }),
  insert: () => ({ values: async () => undefined }),
 }));
 return writes;
}
describe("completeOrder handover", () => {
 it("does not allow a direct done status to bypass handover", async () => {
  const writes = setup(false);
  m.session.mockResolvedValue({ user: { id: "manager", role: "manager" } });
  expect((await setStatus(4, "done")).ok).toBe(false);
  expect(writes).toEqual([]);
 });
 it("does not mutate without a photo", async () => {
  const writes = setup(false, false, []);
  expect(await completeOrder(4, "სამუშაო შესრულდა")).toEqual({ ok: false, error: "დაამატეთ ერთი ფოტო მაინც" });
  expect(writes).toEqual([]); expect(m.notify).not.toHaveBeenCalled();
 });
 it("does not count a colleague's photo for executor handover", async () => {
  const writes = setup(false, false, [{ mimeType: "image/jpeg", uploadedBy: "b" }]);
  expect((await completeOrder(4, "სამუშაო შესრულდა")).ok).toBe(false);
  expect(writes).toEqual([]);
 });
 it("lets staff finish without a photo or checklist; only the note is required", async () => {
  setup(false, false, [], [{ label: "ტესტი", required: true, done: false }]);
  m.session.mockResolvedValue({ user: { id: "manager", role: "manager" } });
  expect((await completeOrder(4, "სამუშაო შესრულდა")).ok).toBe(true);
 });
 it("records only the caller's handover and closes only their visit, leaving the team in progress", async () => {
  const writes = setup(false); expect((await completeOrder(4, "სამუშაო შესრულდა")).ok).toBe(true);
  expect(m.notify).toHaveBeenCalledExactlyOnceWith(["manager", "admin"], {
   type: "done", orderId: 4, title: "ჩაბარდა LN-4 · ვერე", body: "შემსრულებელი: გიორგი · ნაწილი",
  });
  expect(revalidatePath).toHaveBeenCalledWith("/portal");
  expect(writes.find(w => w.table === orders)?.patch).toMatchObject({ status: "in_progress", completedAt: null, completionNote: null });
  const assignee = writes.find(w => w.table === orderAssignees)!;
  expect(assignee.patch).toMatchObject({ doneNote: "სამუშაო შესრულდა" });
  expect(new PgDialect().sqlToQuery(assignee.where!).params).toEqual([4, "a"]);
  const visit = writes.find(w => w.table === orderVisits)!;
  expect(new PgDialect().sqlToQuery(visit.where!).params).toEqual([4, "a"]);
 });
 it("completes after the last person and combines named handover notes", async () => {
  const writes = setup(true); expect((await completeOrder(4, "შემოწმება დასრულდა")).ok).toBe(true);
  expect(m.notify).toHaveBeenCalledWith(["client"], {
   type: "done", orderId: 4, title: "LN-4 ჩაბარდა · ვერე", body: "შემსრულებელი: გიორგი · მენეჯერი ამოწმებს",
  }, { email: false, excludeUserId: "a" });
  expect(m.notify).toHaveBeenCalledWith(["manager", "admin"], expect.objectContaining({ type: "done", body: "შემსრულებელი: გიორგი · სამუშაო დასრულებულია" }));
  expect(writes.find(w => w.table === orders)?.patch).toMatchObject({ status: "done", completionNote: "გიორგი: შემოწმება დასრულდა\nლევანი: კაბელი გაყვანილია" });
 });
 it("notifies the client on staff completion, excluding the author", async () => {
  setup(false);
  m.session.mockResolvedValue({ user: { id: "admin", name: "ადმინი", role: "admin" } });
  expect((await completeOrder(4, "სამუშაო შესრულდა")).ok).toBe(true);
  expect(m.notify).toHaveBeenCalledWith(["manager"], expect.objectContaining({ type: "done" }));
  expect(m.notify).toHaveBeenCalledWith(["client"], expect.objectContaining({ type: "done", orderId: 4 }), { email: false, excludeUserId: "admin" });
 });
 it.each(["closed", "cancelled", "in_progress"] as const)("revalidates portal after %s and only notifies clients on closure", async (status) => {
  setup(true);
  const order = await m.find();
  order.status = "done";
  m.session.mockResolvedValue({ user: { id: "admin", name: "ადმინი", role: "admin" } });
  expect(await setStatus(4, status)).toEqual({ ok: true });
  expect(revalidatePath).toHaveBeenCalledWith("/portal");
  const clientCalls = m.notify.mock.calls.filter(([ids]) => ids.includes("client"));
  if (status === "closed") expect(clientCalls).toEqual([[["client"], {
   type: "status", orderId: 4, title: "LN-4 შესრულებულია · ვერე", body: "სამუშაო დადასტურებულია",
  }, { email: false, excludeUserId: "admin" }]]);
  else expect(clientCalls).toEqual([]);
 });
 it("rejects a duplicate handover without mutations", async () => { const writes = setup(false, true); expect((await completeOrder(4, "ხელმეორე ჩაბარება")).ok).toBe(false); expect(writes).toEqual([]); });
 it("allows staff to complete the whole job", async () => { const writes = setup(false); m.session.mockResolvedValue({ user: { id: "manager", role: "manager" } }); expect((await completeOrder(4, "ყველაფერი შემოწმებულია")).ok).toBe(true); expect(writes.find(w => w.table === orders)?.patch.status).toBe("done"); });
});
