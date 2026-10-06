import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { SessionUser } from "@/lib/session";

const sessions = new AsyncLocalStorage<SessionUser>();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({
 getSession: async () => sessions.getStore() ? { user: sessions.getStore() } : null,
 isStaff: (role: string) => role === "admin" || role === "manager",
 requireUser: async (roles?: string[]) => {
  const me = sessions.getStore();
  if (!me || (roles && !roles.includes(me.role))) throw new Error("Unauthorized QA session");
  return me;
 },
}));
vi.mock("@/db", async () => {
 const url = process.env.QA_DATABASE_URL;
 if (!url) return { db: {}, qaPool: null };
 const parsed = new URL(url);
 if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/linenet_qa") throw new Error("QA refuses any non-isolated database");
 const { Pool } = await import("pg"); const { drizzle } = await import("drizzle-orm/node-postgres"); const schema = await import("@/db/schema");
 const pool = new Pool({ connectionString: url, max: 8 });
 return { db: drizzle(pool, { schema }), qaPool: pool };
});
import { db } from "@/db";
import { clients, sites, user, orders, orderAssignees, orderVisits, orderItems, orderMaterials, orderPayments, orderAttachments, orderChecklistItems, orderEvents, notifications, services, serviceSubgroups, systems, executorCompetencies, orderRequests } from "@/db/schema";
import { takeOrder, addColleague, requestAssignment, decideRequest } from "@/actions/requests";
import { completeOrder, setStatus, setAssignees, updateOrder } from "@/actions/orders";
import { startVisit } from "@/actions/order-work";
import { addOrderItem, updateOrderItem, createService, updateService } from "@/actions/services";
import { createSubgroup, renameSubgroup, deleteSubgroup } from "@/actions/subgroups";
import { getOrderForUser, listMyOrders, listOrders, listOrdersPage, countOrders, oldestOrderDate } from "@/lib/orders";
import { listPortalOrders, getPortalOrder } from "@/lib/portal";
import { PORTAL_TABS, countPortalTabs, portalTabOf } from "@/lib/portal-tabs";
import { portalStatusLabel } from "@/lib/i18n";
import { updatePortalOrder } from "@/actions/portal";
import { assignOrder, assignMany } from "@/actions/plan";
import { parseMonth, monthOptions } from "@/lib/month-filter";
import { canHandle, competenciesByUser, candidateExecutors, boardVisibility } from "@/lib/competencies";
import { executorBucket } from "@/lib/workflow-view";

const prefix = `feedback-${randomUUID()}`;
const category = `${prefix}-cat`;
const roles = { admin: "admin", manager: "manager", other: "manager", a: "executor", b: "executor", outsider: "executor", banned: "executor", client: "client", client2: "client", foreign: "client", bannedClient: "client" } as const;
type Person = keyof typeof roles;
const uid = (key: Person) => `${prefix}-${key}`;
const person = (key: Person): SessionUser => ({ id: uid(key), role: roles[key], name: key, email: `${uid(key)}@qa.invalid` });
const as = <T>(key: Person, task: () => Promise<T>) => sessions.run(person(key), task);
const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [k,v] of Object.entries(values)) fd.set(k,v); return fd; };
let company: number, foreignCompany: number, site: number, foreignSite: number;
let created: number[] = [];
async function order(assignees: Person[] = [], patch: Partial<typeof orders.$inferInsert> = {}) {
 const [o] = await db.insert(orders).values({ title: "QA სამუშაო", triaged: true, status: assignees.length ? "assigned" : "new", clientId: company, siteId: site, ...patch }).returning();
 created.push(o.id);
 if (assignees.length) await db.insert(orderAssignees).values(assignees.map(key => ({ orderId: o.id, userId: uid(key) })));
 return o;
}
const read = (id: number) => db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true, items: true, visits: true } });
const notices = (id: number, type?: string) => db.query.notifications.findMany({ where: and(eq(notifications.orderId, id), type ? eq(notifications.type, type) : undefined) });
const events = (id: number) => db.query.orderEvents.findMany({ where: eq(orderEvents.orderId, id) });
async function photos(id: number, people: Person[]) {
 await db.insert(orderAttachments).values(people.map(key => ({ orderId: id, uploadedBy: uid(key), fileName: `${key}.jpg`, mimeType: "image/jpeg", storagePath: `qa/${prefix}/${key}.jpg` })));
}
function noMoney(value: unknown) {
 if (!value || typeof value !== "object") return;
 for (const [key, entry] of Object.entries(value)) {
  if (["amount", "vatPercent", "unitPrice", "unitCost", "paidTotal", "paidAt", "paymentStatus", "paymentReviewNeeded", "payments", "price"].includes(key)) expect(entry, key).toBeNull();
  else noMoney(entry);
 }
}
async function cleanup() {
 if (created.length) await db.delete(orders).where(inArray(orders.id, created));
 created = [];
 await db.delete(executorCompetencies).where(inArray(executorCompetencies.userId, (Object.keys(roles) as Person[]).map(uid)));
 await db.delete(services).where(eq(services.systemType, category));
 await db.delete(serviceSubgroups).where(eq(serviceSubgroups.systemSlug, category));
}

describe.skipIf(!process.env.QA_DATABASE_URL)("client feedback against isolated PostgreSQL", () => {
 beforeAll(async () => {
  process.env.SMTP_HOST = ""; process.env.SMTP_USER = ""; process.env.SMTP_PASS = ""; process.env.CLIENT_MAIL_DRY_RUN = "1";
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in isolated QA"); }));
  const [c1,c2] = await db.insert(clients).values([{ name: `${prefix} კომპანია` }, { name: `${prefix} სხვა` }]).returning(); company = c1.id; foreignCompany = c2.id;
  const [s1,s2] = await db.insert(sites).values([{ name: "QA ობიექტი", clientId: company }, { name: "QA უცხო", clientId: foreignCompany }]).returning(); site = s1.id; foreignSite = s2.id;
  for (const key of Object.keys(roles) as Person[]) await db.insert(user).values({ ...person(key), banned: key === "banned" || key === "bannedClient", clientId: roles[key] === "client" ? (key === "foreign" ? foreignCompany : company) : null });
  await db.insert(systems).values({ slug: category, name: "QA კატეგორია" });
 });
 beforeEach(cleanup);
 afterAll(async () => {
  try {
   await cleanup();
   await db.delete(systems).where(eq(systems.slug, category));
   await db.delete(user).where(inArray(user.id, (Object.keys(roles) as Person[]).map(uid)));
   await db.delete(clients).where(inArray(clients.id, [company, foreignCompany]));
   expect(fetch).not.toHaveBeenCalled();
  } finally {
   const { qaPool } = await import("@/db") as unknown as { qaPool: { end(): Promise<void> } };
   await qaPool.end(); vi.unstubAllGlobals();
  }
 });

 it("#13 assigns once without starting a visit, records self_assigned and notifies the manager with taken", async () => {
  const o = await order([], { managerId: uid("manager") });
  expect(await as("a", () => takeOrder(o.id))).toEqual({ ok: true });
  const current = (await read(o.id))!;
  expect(current.assignees.map(a => a.userId)).toEqual([uid("a")]);
  expect(current.status).toBe("assigned"); expect(current.arrivedAt).toBeNull();
  expect(current.visits).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "self_assigned")).toHaveLength(1);
  const n = await notices(o.id, "taken"); expect(n).toHaveLength(1);
  expect(n[0]).toMatchObject({ userId: uid("manager"), orderId: o.id });
  for (const text of [o.number, "QA ობიექტი", "a"]) expect(n[0].title).toContain(text);
 });
 it("#13 work starts only after an explicit startVisit following takeOrder", async () => {
  const o = await order(); expect(await as("a", () => takeOrder(o.id))).toEqual({ ok: true });
  const assigned = (await read(o.id))!;
  expect(assigned.status).toBe("assigned"); expect(assigned.visits).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(0);
  expect(await as("a", () => startVisit(o.id))).toMatchObject({ ok: true, data: { resumed: false } });
  const started = (await read(o.id))!;
  expect(started.status).toBe("in_progress"); expect(started.arrivedAt).toBeInstanceOf(Date);
  expect(started.visits).toEqual([expect.objectContaining({ userId: uid("a"), startedAt: expect.any(Date), endedAt: null })]);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(1);
 });
 it.each(["assigned", "in_progress"] as const)("#13/#4 preserve existing %s status without opening visits", async status => {
  const o = await order(["a"], { status });
  expect(await as("b", () => takeOrder(o.id))).toEqual({ ok: true });
  expect((await read(o.id))!.status).toBe(status);
  expect(await as("a", () => addColleague(o.id, uid("outsider")))).toEqual({ ok: true });
  const current = (await read(o.id))!;
  expect(current.status).toBe(status); expect(current.arrivedAt).toBeNull(); expect(current.visits).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(0);
 });
 it.each([{ triaged: false }, { status: "done" as const }, { status: "closed" as const }, { status: "cancelled" as const }])("#13 refuses unavailable order %j without side effects", async patch => {
  const o = await order([], patch); expect((await as("a", () => takeOrder(o.id))).ok).toBe(false);
  expect((await read(o.id))!.assignees).toHaveLength(0); expect(await events(o.id)).toHaveLength(0); expect(await notices(o.id)).toHaveLength(0);
 });
 it("#13 serializes duplicate parallel takes including history and notifications", async () => {
  const o = await order([], { managerId: uid("manager") });
  const results = await Promise.all([as("a", () => takeOrder(o.id)), as("a", () => takeOrder(o.id))]);
  expect(results.filter(r => r.ok)).toHaveLength(1); expect((await read(o.id))!.assignees).toHaveLength(1);
  expect((await read(o.id))!.status).toBe("assigned");
  expect((await read(o.id))!.visits).toHaveLength(0); expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "self_assigned")).toHaveLength(1); expect(await notices(o.id, "taken")).toHaveLength(1);
 });
 it("#13 retains both executors taking concurrently and falls back to staff notifications", async () => {
  const o = await order(); expect((await Promise.all([as("a", () => takeOrder(o.id)), as("b", () => takeOrder(o.id))])).every(r => r.ok)).toBe(true);
  expect((await read(o.id))!.assignees.map(a => a.userId).sort()).toEqual([uid("a"), uid("b")].sort());
  for (const key of ["manager", "other", "admin"] as const) expect((await notices(o.id, "taken")).filter(n => n.userId === uid(key))).toHaveLength(2);
 });
 it("#4 only an assigned executor can add an active unassigned colleague and notify them", async () => {
  const o = await order(["a"], { managerId: uid("manager") });
  for (const key of ["outsider", "client", "manager"] as const) expect((await as(key, () => addColleague(o.id, uid("b")))).ok).toBe(false);
  for (const key of ["client", "banned", "a", "manager"] as const) expect((await as("a", () => addColleague(o.id, uid(key)))).ok).toBe(false);
  expect(await notices(o.id)).toHaveLength(0);
  expect(await as("a", () => addColleague(o.id, uid("b")))).toEqual({ ok: true });
  expect((await as("a", () => addColleague(o.id, uid("b")))).ok).toBe(false);
  expect((await read(o.id))!.assignees.map(a => a.userId).sort()).toEqual([uid("a"), uid("b")].sort());
  expect(await notices(o.id, "assigned")).toEqual([expect.objectContaining({ userId: uid("b"), orderId: o.id })]);
  const current = (await read(o.id))!;
  expect(current.status).toBe("assigned"); expect(current.arrivedAt).toBeNull(); expect(current.visits).toHaveLength(0);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(0);
  expect(await as("b", () => startVisit(o.id))).toMatchObject({ ok: true, data: { resumed: false } });
  const started = (await read(o.id))!; expect(started.status).toBe("in_progress");
  expect(started.visits).toEqual([expect.objectContaining({ userId: uid("b"), endedAt: null })]);
  expect((await events(o.id)).filter(e => e.type === "visit_started")).toHaveLength(1);
 });
 it("#4 rejects a banned assigned actor", async () => {
  const o = await order(["banned"]); expect((await as("banned", () => addColleague(o.id, uid("b")))).ok).toBe(false);
  expect((await read(o.id))!.assignees).toHaveLength(1); expect(await notices(o.id)).toHaveLength(0);
 });
 it("#7 strips real prices, payments and material costs from executor detail and lists", async () => {
  const o = await order(["a"], { amount: "980", paidTotal: "120", paymentStatus: "partial" });
  await db.insert(orderItems).values({ orderId: o.id, name: "QA პოზიცია", unitPrice: "490", quantity: "2" });
  await db.insert(orderMaterials).values({ orderId: o.id, name: "QA მასალა", unitCost: "75" });
  await db.insert(orderPayments).values({ orderId: o.id, amount: "120" });
  await db.insert(orderEvents).values({ orderId: o.id, type: "payment_added", data: { amount: "120" } });
  const staff = await getOrderForUser(o.id, person("manager")); expect(staff?.order.amount).toBe("980.00");
  const view = await getOrderForUser(o.id, person("a")); expect(view?.financeVisible).toBe(false); expect(view?.order.items).toHaveLength(1); expect(view?.order.materials).toHaveLength(1); noMoney(view);
  expect(view!.order).not.toHaveProperty("payments"); expect(view!.order.events.some(e => e.type.startsWith("payment"))).toBe(false);
  const mine = await listMyOrders(uid("a")); expect(mine.map(o => o.id)).toEqual([o.id]); noMoney(mine);
  expect(await getOrderForUser(o.id, person("outsider"))).toBeNull();
 });
 it("#7 executor catalogue price is authoritative, manual price is zero, price updates are ignored", async () => {
  const o = await order(["a"]);
  const [svc] = await db.insert(services).values({ name: "QA სერვისი", systemType: category, price: "27.50" }).returning();
  expect(await as("a", () => addOrderItem(o.id, form({ serviceId: String(svc.id), quantity: "2", unitPrice: "999" })))).toEqual({ ok: true });
  expect(await as("a", () => addOrderItem(o.id, form({ name: "QA ხელით", quantity: "3", unitPrice: "888", unit: "რულონი" })))).toEqual({ ok: true });
  let current = (await read(o.id))!; const catalog = current.items.find(i => i.serviceId === svc.id)!;
  expect(Number(catalog.unitPrice)).toBe(27.5); expect(Number(current.items.find(i => !i.serviceId)!.unitPrice)).toBe(0); expect(current.items.find(i => !i.serviceId)?.unit).toBe("რულონი"); expect(current.amount).toBe("55.00");
  expect(await as("a", () => updateOrderItem(catalog.id, 4, 1))).toEqual({ ok: true });
  current = (await read(o.id))!; expect(Number(current.items.find(i => i.id === catalog.id)!.quantity)).toBe(4); expect(Number(current.items.find(i => i.id === catalog.id)!.unitPrice)).toBe(27.5); expect(current.amount).toBe("110.00");
 });
 it("#9 partial and full handover notify manager/admins, full handover also notifies own active clients", async () => {
  const o = await order(["a", "b"], { managerId: uid("manager"), status: "in_progress" }); await photos(o.id, ["a", "b"]);
  await db.insert(orderChecklistItems).values({ orderId: o.id, label: "QA შემოწმება", required: true, done: true });
  expect(await as("a", () => completeOrder(o.id, "პირველი ნაწილი მზადაა"))).toEqual({ ok: true });
  expect((await read(o.id))!.status).toBe("in_progress");
  let n = (await notices(o.id, "done")).filter(n => n.userId.startsWith(prefix));
  expect(n.map(n => n.userId).sort()).toEqual([uid("admin"), uid("manager")].sort());
  for (const item of n) { expect(item.title).toContain(o.number); expect(item.title).toContain("QA ობიექტი"); expect(item.body).toContain("შემსრულებელი: a"); }
  const previous = new Set(n.map(n => n.id));
  expect(await as("b", () => completeOrder(o.id, "მეორე ნაწილი მზადაა"))).toEqual({ ok: true }); expect((await read(o.id))!.status).toBe("done");
  n = (await notices(o.id, "done")).filter(n => n.userId.startsWith(prefix) && !previous.has(n.id));
  expect(n.map(n => n.userId).sort()).toEqual([uid("admin"), uid("manager"), uid("client"), uid("client2")].sort());
  for (const item of n) { expect(item.orderId).toBe(o.id); expect(item.title).toContain(o.number); expect(item.title).toContain("QA ობიექტი"); expect(item.body).toContain("შემსრულებელი: b"); }
 });
 it("#9 staff fallback excludes the completing author even when they are an admin", async () => {
  const o = await order(["a"]); expect(await as("admin", () => completeOrder(o.id, "ყველაფერი მიღებულია"))).toEqual({ ok: true });
  const n = (await notices(o.id, "done")).filter(n => n.userId.startsWith(prefix));
  expect(n.map(n => n.userId).sort()).toEqual([uid("manager"), uid("other"), uid("client"), uid("client2")].sort());
 });
 it("#10 done → closed notifies clients as შესრულებულია and updates portal data", async () => {
  const o = await order(["a"], { status: "done", completionNote: "მზადაა", completedAt: new Date() });
  expect(await as("manager", () => setStatus(o.id, "closed"))).toEqual({ ok: true });
  const portal = await getPortalOrder(o.id, company); expect(portal?.status).toBe("closed"); expect(portalStatusLabel(portal!.status, portal!.triaged)).toBe("შესრულებულია");
  for (const key of ["client", "client2"] as const) { const n = (await notices(o.id, "status")).filter(n => n.userId === uid(key)); expect(n).toHaveLength(1); expect(n[0].title).toContain("შესრულებულია"); expect(n[0].title).toContain(o.number); }
  expect((await notices(o.id)).some(n => [uid("foreign"), uid("bannedClient")].includes(n.userId))).toBe(false);
 });
 it("#11 portal tab counts match each filtered list across all statuses", async () => {
  await order([], { triaged: false });
  for (const status of ["new", "assigned", "in_progress", "done", "closed", "cancelled"] as const) await order([], { status });
  await order([], { clientId: foreignCompany, siteId: foreignSite });
  const rows = await listPortalOrders(company), counts = countPortalTabs(rows);
  expect(counts).toEqual({ all: 7, sent: 1, planned: 2, progress: 2, done: 1, cancelled: 1 });
  for (const tab of PORTAL_TABS) expect(counts[tab.key]).toBe(rows.filter(o => tab.key === "all" || portalTabOf(o.status, o.triaged) === tab.key).length);
  noMoney(rows);
  expect(await listPortalOrders(company, { siteId: foreignSite })).toHaveLength(0);
  expect(await listPortalOrders(company, { q: "QA ობიექტი", siteId: site })).toHaveLength(7);
 });
 it("#12 portal detail scopes company and projects work/photo data without prices", async () => {
  const o = await order(["a"], { amount: "450" });
  const foreign = await order([], { clientId: foreignCompany, siteId: foreignSite });
  await db.insert(orderItems).values({ orderId: o.id, name: "QA სამუშაო", quantity: "2", unit: "მეტრი", unitPrice: "225" });
  await photos(o.id, ["a"]);
  await db.insert(orderAttachments).values({ orderId: o.id, fileName: "private.pdf", mimeType: "application/pdf", storagePath: "qa/private.pdf" });
  const detail = await getPortalOrder(o.id, company); expect(detail?.items).toHaveLength(1); expect(Number(detail?.items[0].quantity)).toBe(2); expect(detail?.items[0].unit).toBe("მეტრი"); noMoney(detail);
  expect(detail?.attachments.map(a => a.fileName)).toEqual(["a.jpg"]); expect(await getPortalOrder(foreign.id, company)).toBeNull(); expect(await getPortalOrder(o.id, foreignCompany)).toBeNull();
 });
 it("#14/#17 all three lists default to created_at desc regardless of insertion order or urgency", async () => {
  const middle = await order(["a"], { createdAt: new Date("2026-01-02T00:00:00Z") });
  const newest = await order(["a"], { createdAt: new Date("2026-01-03T00:00:00Z"), priority: "low" });
  const oldest = await order(["a"], { createdAt: new Date("2026-01-01T00:00:00Z"), priority: "urgent" });
  for (const rows of [await listOrders({ clientId: company }), await listMyOrders(uid("a")), await listPortalOrders(company)]) expect(rows.map(o => o.id)).toEqual([newest.id, middle.id, oldest.id]);
  expect((await listOrders({ clientId: company }, { sort: "priority" }))[0].id).toBe(oldest.id);
 });
 it("#16 executorBucket partitions real /my data consistently, including partial handover and closed limit", async () => {
  const fresh = await order(["a", "b"], { status: "in_progress" });
  await db.insert(orderVisits).values({ orderId: fresh.id, userId: uid("b") });
  const active = await order(["a"], { status: "in_progress" }); await db.insert(orderVisits).values({ orderId: active.id, userId: uid("a") });
  const partial = await order(["a", "b"], { status: "in_progress" });
  await db.update(orderAssignees).set({ doneAt: new Date() }).where(and(eq(orderAssignees.orderId, partial.id), eq(orderAssignees.userId, uid("a"))));
  const done = await order(["a"], { status: "done" });
  for (let i = 0; i < 21; i++) await order(["a"], { status: i === 0 ? "cancelled" : "closed" });
  await order(["a"], { triaged: false }); await order(["b"]);
  const rows = await listMyOrders(uid("a"));
  const grouped = Object.fromEntries((["new", "active", "done", "closed"] as const).map(key => [key, rows.filter(o => executorBucket(o, uid("a")) === key).map(o => o.id)]));
  expect(grouped.new).toEqual([fresh.id]); expect(grouped.active).toEqual([active.id]); expect(grouped.done.sort()).toEqual([partial.id, done.id].sort()); expect(grouped.closed).toHaveLength(21); expect(grouped.closed.slice(0, 20)).toHaveLength(20);
  // executorCounts is local to AppLayout, not an exported helper. Guard the shared
  // query/bucket wiring read-only; UI rendering remains outside this DB suite.
  for (const path of ["app/(app)/layout.tsx", "app/(app)/my/page.tsx"]) {
   const source = readFileSync(path, "utf8"); expect(source).toMatch(/listMyOrders\((user|me)\.id\)/);
   for (const bucket of ["new", "active", "done", "closed"]) expect(source).toContain(`=== "${bucket}"`);
   expect(source).toMatch(/executorBucket\(o, (user|me)\.id\)/);
  }
 });
 it("#8 creates/renames subgroups, stores service subgroup_id and only deletes empty groups", async () => {
  expect(await as("admin", () => createSubgroup(category, "QA ქვეჯგუფი"))).toEqual({ ok: true });
  const group = (await db.query.serviceSubgroups.findFirst({ where: eq(serviceSubgroups.systemSlug, category) }))!;
  expect(await as("admin", () => renameSubgroup(group.id, "QA ახალი სახელი"))).toEqual({ ok: true });
  expect((await db.query.serviceSubgroups.findFirst({ where: eq(serviceSubgroups.id, group.id) }))?.name).toBe("QA ახალი სახელი");
  const fd = form({ name: "QA სერვისი", systemType: category, subgroupId: String(group.id), price: "25", active: "on" });
  expect(await as("admin", () => createService(fd))).toEqual({ ok: true });
  const svc = (await db.query.services.findFirst({ where: eq(services.systemType, category) }))!; expect(svc.subgroupId).toBe(group.id);
  expect((await as("admin", () => deleteSubgroup(group.id))).ok).toBe(false);
  fd.set("subgroupId", ""); expect(await as("admin", () => updateService(svc.id, fd))).toEqual({ ok: true });
  expect(await as("admin", () => deleteSubgroup(group.id))).toEqual({ ok: true });
  expect(await db.query.serviceSubgroups.findFirst({ where: eq(serviceSubgroups.id, group.id) })).toBeUndefined();
  expect((await db.query.services.findFirst({ where: eq(services.id, svc.id) }))?.subgroupId).toBeNull();
 });
 it("#8 denies subgroup mutations to non-admin roles without changing rows", async () => {
  expect(await as("admin", () => createSubgroup(category, "QA დაცული"))).toEqual({ ok: true });
  const group = (await db.query.serviceSubgroups.findFirst({ where: eq(serviceSubgroups.systemSlug, category) }))!;
  for (const key of ["manager", "a", "client"] as const) {
   expect((await as(key, () => createSubgroup(category, "QA ახალი"))).ok).toBe(false);
   expect((await as(key, () => renameSubgroup(group.id, "QA შეცვლილი"))).ok).toBe(false);
   expect((await as(key, () => deleteSubgroup(group.id))).ok).toBe(false);
  }
  expect(await db.query.serviceSubgroups.findMany({ where: eq(serviceSubgroups.systemSlug, category) })).toEqual([group]);
 });

 // Round two: query boundaries and actual action writes, using the same isolated database.
 it("month parsing uses half-open Tbilisi boundaries and includes empty intervening months", () => {
  expect(parseMonth("2026-01")).toEqual({ from: new Date("2025-12-31T20:00:00Z"), to: new Date("2026-01-31T20:00:00Z") });
  expect(parseMonth("2024-02")).toEqual({ from: new Date("2024-01-31T20:00:00Z"), to: new Date("2024-02-29T20:00:00Z") });
  for (const value of [undefined, "", "2026-00", "2026-13", "2026-1", "0000-01", "2026-01x"]) expect(parseMonth(value)).toBeNull();
  expect(monthOptions(new Date("2025-12-31T20:00:00Z"), new Date("2026-03-01T00:00:00Z"))).toEqual([
   { value: "2026-03", label: "მარტი 2026" }, { value: "2026-02", label: "თებერვალი 2026" }, { value: "2026-01", label: "იანვარი 2026" },
  ]);
 });
 it("month constrains /orders rows, pagination totals and portal by created_at at exact boundaries", async () => {
  const before = await order([], { createdAt: new Date("2025-12-31T19:59:59.999Z"), completedAt: new Date("2026-01-10Z") });
  const first = await order([], { createdAt: new Date("2025-12-31T20:00:00Z"), completedAt: new Date("2026-02-10Z") });
  const last = await order([], { createdAt: new Date("2026-01-31T19:59:59.999Z") });
  await order([], { createdAt: new Date("2026-01-31T20:00:00Z") });
  await order([], { clientId: foreignCompany, siteId: foreignSite, createdAt: first.createdAt });
  const filter = { clientId: company, month: "2026-01" };
  expect((await listOrders(filter)).map(o => o.id)).toEqual([last.id, first.id]);
  expect(await countOrders(filter)).toBe(2);
  const page = await listOrdersPage(filter, 2, 1); expect(page.total).toBe(2); expect(page.pages).toBe(2); expect(page.rows.map(o => o.id)).toEqual([first.id]);
  expect((await listPortalOrders(company, { month: filter.month, siteId: site, q: "QA" })).map(o => o.id)).toEqual([last.id, first.id]);
  expect(await listPortalOrders(company, { month: filter.month, siteId: foreignSite })).toEqual([]);
  expect(await oldestOrderDate(company)).toEqual(before.createdAt);
  for (const month of [undefined, "invalid", "2026-13"]) {
   expect(await listOrders({ clientId: company, month })).toHaveLength(4);
   expect(await listPortalOrders(company, { month })).toHaveLength(4);
  }
  expect(await listOrders({ clientId: company, month: "2025-11" })).toEqual([]);
  expect(await listPortalOrders(company, { month: "2025-11" })).toEqual([]);
 });
 it.each(["a", "manager", "admin"] as const)("completed_at is set by %s handover and preserved on close", async actor => {
  const o = await order(["a"], { warrantyMonths: 12 }); await photos(o.id, ["a"]);
  const start = Date.now();
  expect(await as(actor, () => completeOrder(o.id, "სამუშაო დასრულებულია"))).toEqual({ ok: true });
  const done = (await read(o.id))!;
  expect(done.status).toBe("done"); expect(done.completedAt!.getTime()).toBeGreaterThanOrEqual(start); expect(done.completedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  expect(done.finishedAt).toBeInstanceOf(Date); expect(done.closedAt).toBeNull();
  expect(portalTabOf(done.status, true)).toBe("progress"); expect(portalStatusLabel(done.status, true)).toBe("შემოწმებას ელოდება");
  expect(await as("manager", () => setStatus(o.id, "closed"))).toEqual({ ok: true });
  const closed = (await read(o.id))!;
  expect(closed.completedAt).toEqual(done.completedAt); expect(closed.closedAt).toBeInstanceOf(Date); expect(closed.verifiedBy).toBe(uid("manager"));
  expect(portalTabOf(closed.status, true)).toBe("done"); expect(portalStatusLabel(closed.status, true)).toBe("შესრულებულია");
 });
 it("partial handover leaves completed_at null until the final executor finishes", async () => {
  const o = await order(["a", "b"]); await photos(o.id, ["a", "b"]);
  expect(await as("a", () => completeOrder(o.id, "პირველი ნაწილი მზადაა"))).toEqual({ ok: true });
  expect((await read(o.id))!).toMatchObject({ status: "in_progress", completedAt: null, finishedAt: null });
  expect(await as("b", () => completeOrder(o.id, "მეორე ნაწილი მზადაა"))).toEqual({ ok: true });
  expect((await read(o.id))!).toMatchObject({ status: "done", completedAt: expect.any(Date), finishedAt: expect.any(Date) });
 });
 it("legacy done without completed_at gets a date on close; direct done/early close is rejected", async () => {
  const legacy = await order([], { status: "done" });
  expect(await as("manager", () => setStatus(legacy.id, "closed"))).toEqual({ ok: true });
  const closed = (await read(legacy.id))!; expect(closed.completedAt).toBeInstanceOf(Date); expect(closed.completedAt).toEqual(closed.closedAt);
  const fresh = await order(["a"]);
  expect((await as("manager", () => setStatus(fresh.id, "done"))).ok).toBe(false);
  expect((await as("manager", () => setStatus(fresh.id, "closed"))).ok).toBe(false);
  expect((await read(fresh.id))!).toMatchObject({ status: "assigned", completedAt: null });
 });
 it.each(["new", "assigned", "in_progress"] as const)("reopening done and closed to %s clears completed_at and handover metadata", async status => {
  for (const previous of ["done", "closed"] as const) {
   const o = await order(["a"], { status: previous, completedAt: new Date(), finishedAt: new Date(), completionNote: "ძველი შედეგი", warrantyUntil: "2027-01-01" });
   await db.update(orderAssignees).set({ doneAt: new Date(), doneNote: "ჩაბარებულია" }).where(eq(orderAssignees.orderId, o.id));
   if (previous === "closed") expect((await as("manager", () => setStatus(o.id, status))).ok).toBe(false);
   expect(await as(previous === "closed" ? "admin" : "manager", () => setStatus(o.id, status))).toEqual({ ok: true });
   expect((await read(o.id))!).toMatchObject({ status, completedAt: null, finishedAt: null, completionNote: null, warrantyUntil: null, closedAt: null });
   expect((await read(o.id))!.assignees[0]).toMatchObject({ doneAt: null, doneNote: null });
  }
 });
 it.each(["setAssignees", "updateOrder", "assignOrder", "assignMany", "decideRequest"] as const)("%s adding work to done reopens it and clears completed_at", async route => {
  const o = await order(["a"], { status: "done", completedAt: new Date(), finishedAt: new Date(), completionNote: "მზადაა" });
  let result;
  if (route === "setAssignees") result = await as("manager", () => setAssignees(o.id, [uid("a"), uid("b")]));
  else if (route === "updateOrder") {
   const fd = form({ title: o.title, type: "service", priority: "normal", clientId: String(company), siteId: String(site) });
   fd.append("assignees", uid("a")); fd.append("assignees", uid("b"));
   result = await as("manager", () => updateOrder(o.id, fd));
  } else if (route === "assignOrder") result = await as("manager", () => assignOrder(o.id, form({ assigneeId: uid("b") })));
  else if (route === "assignMany") result = await as("manager", () => assignMany([o.id], form({ assigneeId: uid("b") })));
  else {
   expect(await as("b", () => requestAssignment(o.id))).toEqual({ ok: true });
   const request = (await db.query.orderRequests.findFirst({ where: eq(orderRequests.orderId, o.id) }))!;
   result = await as("manager", () => decideRequest(request.id, true));
  }
  expect(result.ok).toBe(true); expect((await read(o.id))!).toMatchObject({ status: "in_progress", completedAt: null, finishedAt: null, completionNote: null });
 });
 it("done and closed filters stay separate, sort by completion and apply range to completion", async () => {
  const oldCreated = new Date("2020-01-01Z"), now = new Date();
  const done = await order([], { status: "done", createdAt: oldCreated, completedAt: now });
  const earlier = await order([], { status: "done", completedAt: new Date("2021-01-01Z") });
  const legacy = await order([], { status: "done", completedAt: null });
  const closed = await order([], { status: "closed", createdAt: oldCreated, completedAt: now });
  expect((await listOrders({ clientId: company, status: "done" })).map(o => o.id)).toEqual([done.id, earlier.id, legacy.id]);
  expect((await listOrders({ clientId: company, status: "done", range: "today" })).map(o => o.id)).toEqual([done.id]);
  expect((await listOrders({ clientId: company, status: "closed", range: "today" })).map(o => o.id)).toEqual([closed.id]);
 });
 it.each(["new", "assigned"] as const)("client edits own %s order, records exact diff and notifies staff once", async status => {
  const o = await order([], { status, description: "ძველი", source: "portal" });
  const fd = form({ title: "შეცვლილი სათაური", description: "ახალი აღწერა", siteId: String(site), urgent: "on" });
  expect(await as("client", () => updatePortalOrder(o.id, fd))).toEqual({ ok: true });
  expect((await read(o.id))!).toMatchObject({ title: "შეცვლილი სათაური", description: "ახალი აღწერა", priority: "urgent", status, clientId: company });
  const edited = (await events(o.id)).filter(e => e.type === "client_edited");
  expect(edited).toHaveLength(1); expect(edited[0].userId).toBe(uid("client"));
  expect(edited[0].data).toEqual({ changes: [
   { field: "title", from: o.title, to: "შეცვლილი სათაური" }, { field: "description", from: "ძველი", to: "ახალი აღწერა" }, { field: "priority", from: "normal", to: "urgent" },
  ] });
  expect((await notices(o.id, "client_edited")).filter(n => n.userId.startsWith(prefix)).map(n => n.userId).sort()).toEqual([uid("admin"), uid("manager"), uid("other")].sort());
  expect(await as("client", () => updatePortalOrder(o.id, fd))).toEqual({ ok: true });
  expect((await events(o.id)).filter(e => e.type === "client_edited")).toHaveLength(1);
  expect((await notices(o.id, "client_edited")).filter(n => n.userId.startsWith(prefix))).toHaveLength(3);
 });
 it("client edit notifies the assigned manager and rejects foreign companies/sites and staff actors", async () => {
  const o = await order([], { managerId: uid("manager") }); const fd = form({ title: "ახალი სათაური", siteId: String(site) });
  for (const key of ["foreign", "manager", "a"] as const) expect((await as(key, () => updatePortalOrder(o.id, fd))).ok).toBe(false);
  expect((await as("client", () => updatePortalOrder(o.id, form({ title: "ახალი სათაური", siteId: String(foreignSite) })))).ok).toBe(false);
  expect((await read(o.id))!.title).toBe(o.title); expect(await events(o.id)).toEqual([]); expect(await notices(o.id)).toEqual([]);
  expect(await as("client", () => updatePortalOrder(o.id, fd))).toEqual({ ok: true });
  expect((await notices(o.id, "client_edited")).map(n => n.userId)).toEqual([uid("manager")]);
 });
 it.each(["in_progress", "done", "closed", "cancelled"] as const)("client cannot edit %s even with valid own-company fields", async status => {
  const o = await order([], { status }); const before = await read(o.id);
  expect((await as("client", () => updatePortalOrder(o.id, form({ title: "ახალი სათაური", siteId: String(site) })))).ok).toBe(false);
  expect(await read(o.id)).toEqual(before); expect(await events(o.id)).toEqual([]); expect(await notices(o.id)).toEqual([]);
 });
 it("competencies default to all; candidates cover every requested category and exclude banned/non-executors", async () => {
  expect((await competenciesByUser([uid("a"), uid("b")])).get(uid("a"))).toBe("all");
  await db.insert(executorCompetencies).values({ userId: uid("a"), systemSlug: category });
  expect((await competenciesByUser([uid("a"), uid("b")])).get(uid("a"))).toEqual([category]);
  const candidates = async (categories: string[]) => (await candidateExecutors(categories)).filter(u => u.id.startsWith(prefix)).map(u => u.id).sort();
  expect(canHandle(null, [category])).toBe(true);
  expect(canHandle(undefined, [category])).toBe(true);
  expect(canHandle("other-category", [category])).toBe(false);
  expect(await candidates([])).toEqual([uid("a"), uid("b"), uid("outsider")].sort());
  expect(await candidates([category])).toEqual([uid("a"), uid("b"), uid("outsider")].sort());
  expect(await candidates([category, "other-category"])).toEqual([uid("b"), uid("outsider")].sort());
 });
 it("board SQL restricts competencies, preserves staff/all access, excludes inbox and finished closed work", async () => {
  const matching = await order([], { systemType: category });
  const uncategorized = await order();
  const ownUncategorized = await order(["a"]);
  const ownOtherCategory = await order(["a"], { systemType: "electrical" });
  const otherCategory = await order([], { systemType: "electrical" });
  const done = await order([], { systemType: category, status: "done" });
  await order([], { systemType: category, status: "closed" });
  await order([], { systemType: category, status: "cancelled" });
  await order([], { systemType: category, triaged: false });
  await db.insert(executorCompetencies).values({ userId: uid("a"), systemSlug: category });
  const visible = async (key: Person) => (await db.select({ id: orders.id }).from(orders).where(and(eq(orders.clientId, company), await boardVisibility(person(key))))).map(o => o.id).sort((a,b) => a-b);
  expect(await visible("a")).toEqual([matching.id, uncategorized.id, ownUncategorized.id, ownOtherCategory.id, done.id]);
  expect(await getOrderForUser(ownOtherCategory.id, person("a"))).not.toBeNull();
  for (const key of ["b", "manager", "admin"] as const) expect(await visible(key)).toEqual([matching.id, uncategorized.id, ownUncategorized.id, ownOtherCategory.id, otherCategory.id, done.id]);
 });
 it("restricted executors can join uncategorized orders as colleagues", async () => {
  await db.insert(executorCompetencies).values({ userId: uid("b"), systemSlug: category });
  const o = await order(["a"]);
  const candidates = (await candidateExecutors([])).filter(u => canHandle(o.systemType, u.competencies));
  expect(candidates.map(u => u.id)).toContain(uid("b"));
  expect(await as("a", () => addColleague(o.id, uid("b")))).toEqual({ ok: true });
 });
 it("portal exposes arrival and only the earliest actual visit without internal visit fields", async () => {
  const arrivedAt = new Date("2026-09-10T10:00:00Z");
  const o = await order(["a"], { status: "done", arrivedAt });
  await db.insert(orderVisits).values([
   { orderId: o.id, userId: uid("a"), startedAt: new Date("2026-09-11T10:00:00Z"), endedAt: new Date("2026-09-11T11:00:00Z") },
   { orderId: o.id, userId: uid("a"), startedAt: arrivedAt, endedAt: new Date("2026-09-10T11:00:00Z") },
  ]);
  const detail = await getPortalOrder(o.id, company);
  expect(detail?.arrivedAt).toEqual(arrivedAt);
  expect(detail?.visits).toEqual([{ startedAt: arrivedAt }]);
 });
 it("executor handover requires their own image on this order, not a colleague image or own PDF", async () => {
  const o = await order(["a", "b"]); await photos(o.id, ["b"]);
  await db.insert(orderAttachments).values({ orderId: o.id, uploadedBy: uid("a"), fileName: "a.pdf", mimeType: "application/pdf", storagePath: "qa/a.pdf" });
  const other = await order(["a"]); await photos(other.id, ["a"]);
  expect((await as("a", () => completeOrder(o.id, "ჩემი ნაწილი მზადაა"))).ok).toBe(false);
  expect((await read(o.id))!.assignees.every(a => a.doneAt === null)).toBe(true);
  await photos(o.id, ["a"]); expect(await as("a", () => completeOrder(o.id, "ჩემი ნაწილი მზადაა"))).toEqual({ ok: true });
 });
});
