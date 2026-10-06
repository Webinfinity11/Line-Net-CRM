import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { SessionUser } from "@/lib/session";
const sessions = new AsyncLocalStorage<SessionUser>();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessions.getStore() ? { user: sessions.getStore() } : null, isStaff: (role: string) => role === "admin" || role === "manager" }));
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
import { clients, sites, siteContacts, user, orders, orderAssignees, orderRequests, orderVisits, orderItems, orderEvents, notifications, appSettings, orderAttachments } from "@/db/schema";
import { updateOrder, setAssignees, completeOrder, setStatus, takeOverOrder } from "@/actions/orders";
import { addPayment } from "@/actions/payments";
import { startVisit } from "@/actions/order-work";
import { requestAssignment, decideRequest } from "@/actions/requests";
import { addOrderItem, updateOrderItem, removeOrderItem } from "@/actions/services";
import { saveSiteContact, deleteSiteContact } from "@/actions/site-contacts";
import { recomputeOrderAmount } from "@/lib/order-items";
import { assignOrder, assignMany } from "@/actions/plan";
import { getOrderForUser } from "@/lib/orders";
import { previewClientMail, sendClientMail } from "@/lib/client-mail";
import { createOrderFromEmail } from "@/lib/inbound-email";
import { claimManagerIfEmpty } from "@/lib/order-team";
const roles: Record<string, SessionUser["role"]> = { admin: "admin", manager: "manager", other: "manager", a: "executor", b: "executor", c: "executor", client: "client" };
const as = <T>(id: string, task: () => Promise<T>) => sessions.run({ id, role: roles[id], name: id, email: `${id}@qa.invalid` }, task);
const form = (values: Record<string, string>) => { const fd = new FormData(); for (const [k,v] of Object.entries(values)) fd.set(k,v); return fd; };
let company: number, foreignCompany: number, site: number, foreignSite: number;
let created: number[] = [];
async function order(assignees: string[] = [], patch: Partial<typeof orders.$inferInsert> = {}) {
 const [o] = await db.insert(orders).values({ title: "QA სამუშაო", triaged: true, status: assignees.length ? "assigned" : "new", clientId: company, siteId: site, ...patch }).returning(); created.push(o.id);
 if (assignees.length) await db.insert(orderAssignees).values(assignees.map(userId => ({ orderId: o.id, userId })));
 return o;
}
async function photos(id: number, people: string[]) {
 await db.insert(orderAttachments).values(people.map(uploadedBy => ({ orderId: id, uploadedBy, fileName: `${uploadedBy}.jpg`, mimeType: "image/jpeg", storagePath: `qa/${id}/${uploadedBy}.jpg` })));
}
const read = (id: number) => db.query.orders.findFirst({ where: eq(orders.id, id), with: { assignees: true, items: true, visits: true, requests: true } });
describe.skipIf(!process.env.QA_DATABASE_URL)("isolated PostgreSQL team-flow QA", () => {
 beforeAll(async () => {
  process.env.SMTP_HOST = ""; process.env.SMTP_USER = ""; process.env.SMTP_PASS = ""; process.env.CLIENT_MAIL_DRY_RUN = "1";
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in isolated QA"); }));
  for (const [id,role] of Object.entries(roles)) await db.insert(user).values({ id, role, name: id, email: `${id}@qa.invalid` }).onConflictDoNothing();
  const [c1,c2] = await db.insert(clients).values([{ name: "QA კომპანია", email: "office@qa.invalid" }, { name: "QA სხვა" }]).returning(); company=c1.id; foreignCompany=c2.id;
  const [s1,s2] = await db.insert(sites).values([{ name: "QA ობიექტი", clientId: company }, { name: "QA უცხო", clientId: foreignCompany }]).returning(); site=s1.id; foreignSite=s2.id;
  await db.update(user).set({ clientId: company }).where(eq(user.id,"client"));
 });
 beforeEach(async () => { if (created.length) await db.delete(orders).where(inArray(orders.id, created)); created=[]; });
 afterAll(async () => {
  if (created.length) await db.delete(orders).where(inArray(orders.id, created));
  await db.delete(clients).where(inArray(clients.id, [company, foreignCompany]));
  await db.delete(user).where(inArray(user.id,Object.keys(roles)));
  const { qaPool } = await import("@/db") as unknown as { qaPool: { end(): Promise<void> } }; await qaPool.end(); vi.unstubAllGlobals();
 });
 it("serializes competing first-manager claims without replacing the winner", async () => {
  const o=await order(); await Promise.all(["manager","other"].map(id=>db.transaction(tx=>claimManagerIfEmpty(tx,o.id,id))));
  const first=(await read(o.id))!.managerId; await db.transaction(tx=>claimManagerIfEmpty(tx,o.id,first==="manager"?"other":"manager")); expect((await read(o.id))!.managerId).toBe(first);
 });
 it("records a deliberate takeover and notifies the previous manager", async () => {
  const o=await order([], {managerId:"manager"}); expect((await as("other",()=>takeOverOrder(o.id))).ok).toBe(true);
  const e=await db.query.orderEvents.findFirst({where:and(eq(orderEvents.orderId,o.id),eq(orderEvents.type,"manager_changed"))}); expect(e?.data).toMatchObject({from:"manager",to:"other"});
  expect(await db.query.notifications.findFirst({where:and(eq(notifications.orderId,o.id),eq(notifications.userId,"manager"))})).toBeTruthy();
 });
 it("deduplicates simultaneous pending requests", async () => {
  const o=await order(); const results=await Promise.all([as("a",()=>requestAssignment(o.id)),as("a",()=>requestAssignment(o.id))]); expect(results.filter(r=>r.ok)).toHaveLength(1); expect((await read(o.id))!.requests).toHaveLength(1);
 });
 it("approves once under competing managers and preserves existing assignees", async () => {
  const o=await order(["b"]); await as("a",()=>requestAssignment(o.id)); const id=(await read(o.id))!.requests[0].id;
  const results=await Promise.all([as("manager",()=>decideRequest(id,true)),as("other",()=>decideRequest(id,true))]); expect(results.filter(r=>r.ok)).toHaveLength(1); expect((await read(o.id))!.assignees.map(a=>a.userId).sort()).toEqual(["a","b"]);
 });
 it("denies colleague requests from an unassigned executor", async () => { const o=await order(["b"]); expect((await as("a",()=>requestAssignment(o.id,"c"))).ok).toBe(false); });
 it("runs request → assignment → two visits → two handovers → manager close", async () => {
  const o=await order(["a"]); await as("a",()=>requestAssignment(o.id,"b")); const request=(await read(o.id))!.requests[0]; expect((await as("manager",()=>decideRequest(request.id,true))).ok).toBe(true);
  expect((await as("a",()=>startVisit(o.id))).ok).toBe(true); expect((await as("b",()=>startVisit(o.id))).ok).toBe(true); await photos(o.id,["a","b"]);
  expect((await as("a",()=>completeOrder(o.id,"პირველი ნაწილი დასრულდა"))).ok).toBe(true); expect((await read(o.id))!.status).toBe("in_progress");
  expect((await as("manager",()=>setStatus(o.id,"closed"))).ok).toBe(false);
  expect((await as("b",()=>completeOrder(o.id,"მეორე ნაწილი დასრულდა"))).ok).toBe(true); expect((await read(o.id))!.status).toBe("done");
  expect((await read(o.id))!.completionNote).toContain("a: პირველი"); expect((await read(o.id))!.visits.every(v=>v.endedAt)).toBe(true);
  expect((await as("manager",()=>setStatus(o.id,"closed",true))).ok).toBe(true); expect((await read(o.id))!.verifiedBy).toBe("manager"); expect(fetch).not.toHaveBeenCalled();
 });
 it("serializes concurrent last handovers without losing either note", async () => {
  const o=await order(["a","b"],{status:"in_progress"}); await photos(o.id,["a","b"]); const result=await Promise.all([as("a",()=>completeOrder(o.id,"პირველი დასრულდა")),as("b",()=>completeOrder(o.id,"მეორე დასრულდა"))]); expect(result.every(r=>r.ok)).toBe(true); const current=(await read(o.id))!; expect(current.status).toBe("done"); expect(current.completionNote).toContain("a:"); expect(current.completionNote).toContain("b:");
 });
 it("reopening done work clears completion dates and warranty until new handover", async () => {
  const o=await order(["a"],{warrantyMonths:12}); await photos(o.id,["a"]); expect((await as("a",()=>completeOrder(o.id,"ყველაფერი დასრულდა"))).ok).toBe(true); await as("manager",()=>setStatus(o.id,"in_progress"));
  const current=(await read(o.id))!; expect(current.assignees[0].doneAt).toBeNull(); expect(current.completedAt).toBeNull(); expect(current.completionNote).toBeNull(); expect(current.warrantyUntil).toBeNull();
 });
 it("admin reopening a closed order lets the executor work and hand over again", async () => {
  const o=await order(["a"]); await photos(o.id,["a"]); expect((await as("a",()=>completeOrder(o.id,"ყველაფერი დასრულდა"))).ok).toBe(true); await as("manager",()=>setStatus(o.id,"closed")); await as("admin",()=>setStatus(o.id,"in_progress"));
  expect((await read(o.id))!.assignees[0].doneAt).toBeNull(); expect((await as("a",()=>startVisit(o.id))).ok).toBe(true); expect((await as("a",()=>completeOrder(o.id,"ახალი სამუშაო დასრულდა"))).ok).toBe(true);
 });
 it("last line deletion clears the amount while a no-lines manual order retains its amount", async () => {
  const o=await order(["a"],{amount:"999"}); expect((await as("manager",()=>addOrderItem(o.id,form({name:"კაბელი",unit:"მეტრი",quantity:"12.5",unitPrice:"3.2"})))).ok).toBe(true);
  let current=(await read(o.id))!; expect(current.amount).toBe("40.00"); await as("manager",()=>removeOrderItem(current.items[0].id)); current=(await read(o.id))!; expect(current.amount).toBe("0.00");
 });
 it("denies editing a colleague line and returns no payment fields to executors", async () => {
  const o=await order(["a","b"]); await as("a",()=>addOrderItem(o.id,form({name:"პოზიცია",quantity:"1",unitPrice:"100"}))); const item=(await read(o.id))!.items[0]; expect((await as("b",()=>updateOrderItem(item.id,1,0))).ok).toBe(false);
  const view=await getOrderForUser(o.id,{id:"b",role:"executor",name:"b",email:"b@qa.invalid"}); expect(view?.order.amount).toBeNull(); expect(view?.order.vatPercent).toBeNull(); expect(view?.order.items[0].unitPrice).toBeNull(); expect(view?.order).not.toHaveProperty("paidTotal"); expect(view?.order).not.toHaveProperty("payments");
 });
 it("rejects assigning a client login instead of a team member", async () => { const o=await order(); expect((await as("manager",()=>setAssignees(o.id,["client"]))).ok).toBe(false); expect((await read(o.id))!.assignees).toHaveLength(0); });
 it("resolves a pending request when staff directly assigns the requested person", async () => { const o=await order(); await as("a",()=>requestAssignment(o.id)); await as("manager",()=>setAssignees(o.id,["a"])); expect((await read(o.id))!.requests[0].status).toBe("approved"); });
 it("lets staff decline a stale request after cancellation", async () => { const o=await order(); await as("a",()=>requestAssignment(o.id)); const id=(await read(o.id))!.requests[0].id; await as("manager",()=>setStatus(o.id,"cancelled")); expect((await as("manager",()=>decideRequest(id,false))).ok).toBe(true); });
 it("enforces company ownership on both contact create and update", async () => {
  expect((await as("client",()=>saveSiteContact(foreignSite,null,form({name:"უცხო"})))).ok).toBe(false);
  expect((await as("client",()=>saveSiteContact(site,null,form({name:"საკუთარი",email:"branch@qa.invalid",receivesEmail:"on"})))).ok).toBe(true);
  const contact=(await db.query.siteContacts.findFirst({where:eq(siteContacts.siteId,site)}))!;
  expect((await as("client",()=>saveSiteContact(foreignSite,contact.id,form({name:"შეცვლილი"})))).ok).toBe(false); expect((await as("client",()=>deleteSiteContact(contact.id))).ok).toBe(false);
  const o=await order(); expect((await previewClientMail(o.id,"received"))?.to).toEqual(["branch@qa.invalid"]);
 });
 it("keeps line-driven totals when the edit form sends a different amount", async () => {
  const o=await order(["a"]); await as("manager",()=>addOrderItem(o.id,form({name:"პოზიცია",quantity:"1",unitPrice:"100"})));
  const fd=form({title:"განახლებული სამუშაო",type:"service",priority:"normal",amount:"999",clientId:String(company),siteId:String(site)}); fd.append("assignees","a");
  expect((await as("manager",()=>updateOrder(o.id,fd))).ok).toBe(true); expect((await read(o.id))!.amount).toBe("100.00");
 });
 it("preserves a manually entered total when no lines ever existed", async () => { const o=await order([],{amount:"999"}); await db.transaction(tx=>recomputeOrderAmount(tx,o.id)); expect((await read(o.id))!.amount).toBe("999.00"); });
 it("staff completion closes all open visits and partial handover does not start warranty", async () => {
  const o=await order(["a","b"],{warrantyMonths:12}); await as("a",()=>startVisit(o.id)); await as("b",()=>startVisit(o.id)); await photos(o.id,["a"]); expect((await as("a",()=>completeOrder(o.id,"ჩემი ნაწილი მზადაა"))).ok).toBe(true); expect((await read(o.id))!.warrantyUntil).toBeNull();
  await as("manager",()=>completeOrder(o.id,"მთლიანი სამუშაო მიღებულია")); expect((await read(o.id))!.visits.every(v=>v.endedAt)).toBe(true);
 });
 it("planning rejects client targets and does not overwrite an existing manager", async () => {
  const o=await order([],{managerId:"other"}); expect((await as("manager",()=>assignOrder(o.id,form({assigneeId:"client"})))).ok).toBe(false);
  expect((await as("manager",()=>assignOrder(o.id,form({assigneeId:"a",scheduledAt:"2026-10-01T10:00:00+04:00"})))).ok).toBe(true); expect((await read(o.id))!.managerId).toBe("other");
  const second=await order(); expect((await as("manager",()=>assignMany([o.id,second.id],form({assigneeId:"b"})))).ok).toBe(true); expect((await read(second.id))!.status).toBe("assigned");
 });
 it("serializes concurrent payments so the paid total matches all receipts", async () => {
  const o=await order([],{amount:"100"}); const result=await Promise.all([as("manager",()=>addPayment(o.id,form({amount:"40",method:"transfer"}))),as("other",()=>addPayment(o.id,form({amount:"60",method:"transfer"})))]);
  expect(result.every(r=>r.ok)).toBe(true); expect((await read(o.id))!.paidTotal).toBe("100.00"); expect((await read(o.id))!.paymentStatus).toBe("paid");
 });
 it("requires an email address when a contact opts in to email", async () => { expect((await as("client",()=>saveSiteContact(site,null,form({name:"კონტაქტი",receivesEmail:"on"})))).ok).toBe(false); });
 it("does not send even with client mail enabled in the isolated QA database", async () => {
  const o=await order(); await db.insert(appSettings).values({key:"client_emails_enabled",value:true}).onConflictDoUpdate({target:appSettings.key,set:{value:true}}); await sendClientMail(o.id,"received","manager"); expect(fetch).not.toHaveBeenCalled();
  const event=await db.query.orderEvents.findFirst({where:and(eq(orderEvents.orderId,o.id),eq(orderEvents.type,"client_email"))}); expect(event?.data).toMatchObject({ok:false,skipped:expect.any(String)});
 });
 it("imports named inbound mail once, triages and schedules it once, then prepares the completion invoice", async () => {
  const mail={messageId:`<qa-${crypto.randomUUID()}@qa.invalid>`,from:"sender@qa.invalid",fromName:"კლიენტი",subject:"QA წერილი",html:"<p>შეკეთება<br>საჭიროა</p>"};
  const id=await createOrderFromEmail(mail); expect(id).not.toBeNull(); created.push(id!);
  expect(await createOrderFromEmail(mail)).toBeNull();
  expect(await read(id!)).toMatchObject({source:"email",triaged:false,emailFrom:"კლიენტი <sender@qa.invalid>",description:"შეკეთება\nსაჭიროა"});
  expect((await previewClientMail(id!,"received"))?.to).toEqual(["sender@qa.invalid"]);
  const fd=form({title:"QA წერილი",type:"service",priority:"normal",clientId:String(company),siteId:String(site),scheduledAt:"2026-10-01T06:00:00Z"}); fd.append("assignees","a");
  expect((await as("manager",()=>updateOrder(id!,fd))).ok).toBe(true);
  expect((await as("manager",()=>updateOrder(id!,fd))).ok).toBe(true);
  const events=await db.query.orderEvents.findMany({where:and(eq(orderEvents.orderId,id!),eq(orderEvents.type,"client_email"))});
  expect(events.map(e=>(e.data as {kind:string}).kind).sort()).toEqual(["received","scheduled"]);
  await as("a",()=>addOrderItem(id!,form({name:"შეკეთება",quantity:"1",unitPrice:"100"})));
  await photos(id!,["a"]); expect((await as("a",()=>completeOrder(id!,"შეკეთება დასრულდა"))).ok).toBe(true);
  expect((await as("manager",()=>setStatus(id!,"closed",true))).ok).toBe(true);
  const completed=await previewClientMail(id!,"completed"); expect(completed?.to).toEqual(["sender@qa.invalid"]); expect(completed?.html).toContain("ინვოისი"); expect(completed?.text).toContain("შეკეთება დასრულდა");
  expect((await db.query.orderEvents.findMany({where:and(eq(orderEvents.orderId,id!),eq(orderEvents.type,"client_email"))})).map(e=>(e.data as {kind:string}).kind).sort()).toEqual(["completed","received","scheduled"]); expect(fetch).not.toHaveBeenCalled();
 });
 it("triages portal mail once and resolves opted-in contacts before company fallback", async () => {
  const o=await order([],{source:"portal",triaged:false});
  const fd=form({title:"QA კაბინეტი",type:"service",priority:"normal",clientId:String(company),siteId:String(site)});
  expect((await as("manager",()=>updateOrder(o.id,fd))).ok).toBe(true); await as("manager",()=>updateOrder(o.id,fd));
  expect(await db.query.orderEvents.findMany({where:and(eq(orderEvents.orderId,o.id),eq(orderEvents.type,"client_email"))})).toHaveLength(1);
  await db.delete(siteContacts).where(eq(siteContacts.siteId,site));
  expect((await previewClientMail(o.id,"received"))?.to).toEqual(["office@qa.invalid"]);
  await db.insert(siteContacts).values([{siteId:site,name:"პირადი",email:"private@qa.invalid",receivesEmail:false},{siteId:site,name:"ობიექტი",email:"branch@qa.invalid",receivesEmail:true}]);
  expect((await previewClientMail(o.id,"received"))?.to).toEqual(["branch@qa.invalid"]);
 });
 it("sends scheduling events only for changed dates in individual and bulk planning", async () => {
  const one=await order(),two=await order(); const fd=form({assigneeId:"a",scheduledAt:"2026-10-02T06:00:00Z"});
  expect((await as("manager",()=>assignOrder(one.id,fd))).ok).toBe(true); await as("manager",()=>assignOrder(one.id,fd));
  expect((await as("manager",()=>assignMany([one.id,two.id],fd))).ok).toBe(true);
  for(const id of [one.id,two.id]) expect(await db.query.orderEvents.findMany({where:and(eq(orderEvents.orderId,id),eq(orderEvents.type,"client_email"))})).toHaveLength(1);
 });
 it("closing without report consent does not trigger completed mail", async () => {
  const o=await order(["a"]); await photos(o.id,["a"]); expect((await as("a",()=>completeOrder(o.id,"შესრულებულია"))).ok).toBe(true); expect((await as("manager",()=>setStatus(o.id,"closed",false))).ok).toBe(true);
  expect(await db.query.orderEvents.findMany({where:and(eq(orderEvents.orderId,o.id),eq(orderEvents.type,"client_email"))})).toHaveLength(0);
 });

});
