import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), require: vi.fn(), transaction: vi.fn(), sync: vi.fn(), notify: vi.fn(), staff: vi.fn(), refresh: vi.fn(), claim: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("@/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/session", () => ({ getSession: m.session, requireUser: m.require, isStaff: (r: string) => ["admin", "manager"].includes(r) }));
vi.mock("@/lib/assignees", () => ({ syncAssignees: m.sync }));
vi.mock("@/lib/order-team", () => ({ claimManagerIfEmpty: m.claim }));
vi.mock("@/lib/notify", () => ({ notifyUsers: m.notify, staffUserIds: m.staff }));
import { addColleague, takeOrder } from "@/actions/requests";
import { orders, orderVisits, orderEvents } from "@/db/schema";
const me = { id: "executor", name: "გიორგი", role: "executor" };
beforeEach(() => {
 vi.resetAllMocks(); m.session.mockResolvedValue({ user: me }); m.require.mockResolvedValue(me); m.staff.mockResolvedValue(["admin", "staff"]);
});
function transaction(options: { status?: string; triaged?: boolean; current?: string[]; managerId?: string | null; banned?: boolean; actorBanned?: boolean; missing?: boolean; title?: string; siteId?: number | null } = {}) {
 const order = { id: 4, number: "LN-00004", title: options.title ?? "მონტაჟი", description: "ა".repeat(100), status: options.status ?? "new", triaged: options.triaged ?? true, managerId: options.managerId === undefined ? "manager" : options.managerId, siteId: options.siteId === undefined ? 3 : options.siteId };
 const patches: { table: unknown; value: unknown }[] = [];
 const inserts: { table: unknown; value: unknown }[] = [];
 let reads = 0;
 const tx = {
  insert: (table: unknown) => ({ values: (value: unknown) => { inserts.push({ table, value }); return { onConflictDoNothing: () => ({ returning: async () => [{ id: 42 }] }) }; } }),
  query: { user: { findFirst: vi.fn().mockResolvedValueOnce(options.actorBanned ? undefined : me).mockResolvedValue(options.banned ? undefined : { id: "colleague", name: "ლევანი" }) }, sites: { findFirst: vi.fn().mockResolvedValue({ name: "ობიექტი" }) } },
  select: () => ({ from: () => ({ where: () => ++reads === 1 ? { for: async () => options.missing ? [] : [order] } : Promise.resolve((options.current ?? []).map(userId => ({ userId }))) }) }),
  update: (table: unknown) => ({ set: (value: unknown) => { patches.push({ table, value }); return { where: async () => [] }; } }),
 };
 let committed = false;
 m.transaction.mockImplementation(async cb => { const result = await cb(tx); committed = true; return result; });
 m.notify.mockImplementation(async () => { expect(committed).toBe(true); });
 return { patches, inserts, tx };
}
function noAssignment() { expect(m.sync).not.toHaveBeenCalled(); expect(m.notify).not.toHaveBeenCalled(); }
describe("takeOrder", () => {
 it.each(["admin", "manager", "client"])("rejects %s before database access", async role => {
  m.session.mockResolvedValue({ user: { ...me, role } }); expect((await takeOrder(4)).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled();
 });
 it("rejects no session", async () => { m.session.mockResolvedValue(null); expect((await takeOrder(4)).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled(); });
 it.each(["done", "closed", "cancelled"])("rejects %s", async status => { transaction({ status }); expect((await takeOrder(4)).ok).toBe(false); noAssignment(); });
 it("rejects untriaged orders", async () => { transaction({ triaged: false }); expect((await takeOrder(4)).ok).toBe(false); noAssignment(); });
 it("rejects missing orders", async () => { transaction({ missing: true }); expect((await takeOrder(4)).ok).toBe(false); noAssignment(); });
 it("rejects an existing assignee", async () => { transaction({ current: [me.id] }); expect(await takeOrder(4)).toEqual({ ok: false, error: "უკვე დანიშნული ხართ" }); noAssignment(); });
 it("rejects a banned actor", async () => { transaction({ actorBanned: true }); expect((await takeOrder(4)).ok).toBe(false); noAssignment(); });
 it("assigns immediately and notifies only the manager after commit", async () => {
  const { patches, inserts } = transaction(); expect(await takeOrder(4)).toEqual({ ok: true });
  expect(m.require).toHaveBeenCalledWith(["executor"]);
  expect(m.sync).toHaveBeenCalledWith(expect.anything(), 4, [], [me.id], me.id, false, "self_assigned");
  expect(patches).toEqual([{ table: orders, value: { status: "in_progress", arrivedAt: expect.any(Date), updatedAt: expect.any(Date) } }]);
  expect(m.notify).toHaveBeenCalledExactlyOnceWith(["manager"], { type: "taken", title: "აიღო: გიორგი · LN-00004 · ობიექტი", body: "მონტაჟი", orderId: 4 });
  expect(inserts).toEqual([{ table: orderVisits, value: { orderId: 4, userId: me.id, startedAt: expect.any(Date) } }, { table: orderEvents, value: { orderId: 4, userId: me.id, type: "visit_started", data: { visitId: 42 } } }]);
  expect(m.claim).not.toHaveBeenCalled(); expect(m.staff).not.toHaveBeenCalled();
  for (const path of ["/my", "/my/board", "/orders/4", "/orders", "/inbox"]) expect(m.refresh).toHaveBeenCalledWith(path);
 });
 it("notifies staff without a manager and uses fallback text", async () => {
  transaction({ managerId: null, title: "", siteId: null }); expect((await takeOrder(4)).ok).toBe(true);
  expect(m.notify).toHaveBeenCalledWith(["admin", "staff"], expect.objectContaining({ type: "taken", title: "აიღო: გიორგი · LN-00004 · —", body: "ა".repeat(80) }));
 });
 it.each(["assigned", "in_progress"])("starts work from %s status", async status => { const { patches } = transaction({ status }); expect((await takeOrder(4)).ok).toBe(true); expect(patches[0].value).toMatchObject({ status: "in_progress" }); });
});
describe("addColleague", () => {
 it("rejects an unassigned caller", async () => { transaction(); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it("rejects a banned colleague", async () => { transaction({ current: [me.id], banned: true }); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it("rejects a banned caller", async () => { transaction({ current: [me.id], actorBanned: true }); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it("rejects an existing colleague", async () => { transaction({ current: [me.id, "colleague"] }); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it.each(["done", "closed", "cancelled"])("rejects %s", async status => { transaction({ current: [me.id], status }); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it("rejects untriaged orders", async () => { transaction({ current: [me.id], triaged: false }); expect((await addColleague(4, "colleague")).ok).toBe(false); noAssignment(); });
 it("assigns and notifies colleague and manager after commit", async () => {
  transaction({ current: [me.id], status: "assigned" }); expect(await addColleague(4, "colleague")).toEqual({ ok: true });
  expect(m.sync).toHaveBeenCalledWith(expect.anything(), 4, [me.id], [me.id, "colleague"], me.id, false);
  expect(m.notify).toHaveBeenCalledTimes(2);
  expect(m.notify).toHaveBeenCalledWith(["colleague"], expect.objectContaining({ type: "assigned", orderId: 4 }), { excludeUserId: me.id });
  expect(m.notify).toHaveBeenCalledWith(["manager"], { type: "taken", title: "გიორგი-მა დაამატა ლევანი · LN-00004", orderId: 4 });
  expect(m.claim).not.toHaveBeenCalled();
 });
 it("notifies staff when there is no manager", async () => { transaction({ current: [me.id], managerId: null }); expect((await addColleague(4, "colleague")).ok).toBe(true); expect(m.notify).toHaveBeenCalledWith(["admin", "staff"], expect.objectContaining({ type: "taken" })); });
});
