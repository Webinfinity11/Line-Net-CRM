import { describe, expect, it } from "vitest";
import { allAssigneesDone, assigneeStage, comparePriority } from "@/lib/team-flow";
import { clientMailRecipients, renderClientMail } from "@/lib/client-mail-content";
describe("team handover and priority", () => {
 it("requires every assigned person, and does not complete an empty team", () => {
  expect(allAssigneesDone([])).toBe(false);
  expect(allAssigneesDone([{ doneAt: new Date() }, { doneAt: null }])).toBe(false);
  expect(allAssigneesDone([{ doneAt: new Date() }, { doneAt: new Date() }])).toBe(true);
 });
 it("shows each person's own stage independently of the order", () => {
  const visits = [{ userId: "a" }];
  expect(assigneeStage({ userId: "b", doneAt: null }, visits)).toBe("დანიშნული");
  expect(assigneeStage({ userId: "a", doneAt: null }, visits)).toBe("მუშაობს");
  expect(assigneeStage({ userId: "a", doneAt: new Date() }, visits)).toBe("ჩააბარა");
 });
 it("sorts urgent, high, normal, low while retaining secondary ordering", () => {
  const rows = [{ priority: "low", n: 1 }, { priority: "high", n: 1 }, { priority: "normal", n: 1 }, { priority: "urgent", n: 2 }, { priority: "urgent", n: 1 }] as const;
  expect([...rows].sort((a,b) => comparePriority(a,b) || a.n-b.n).map(o => `${o.priority}:${o.n}`)).toEqual(["urgent:1", "urgent:2", "high:1", "normal:1", "low:1"]);
 });
});
describe("client mail recipients and content", () => {
 const client = { email: "office@example.com" };
 const site = { contacts: [{ email: "branch@example.com", receivesEmail: true }, { email: "private@example.com", receivesEmail: false }, { email: "branch@example.com", receivesEmail: true }] };
 it("answers inbound mail only to its original sender", () => expect(clientMailRecipients({ source: "email", emailFrom: "sender@example.com", site, client })).toEqual(["sender@example.com"]));
 it("uses opted-in branch contacts, deduplicating them", () => expect(clientMailRecipients({ source: "portal", emailFrom: null, site, client })).toEqual(["branch@example.com"]));
 it("falls back to the company address", () => expect(clientMailRecipients({ source: "manual", emailFrom: null, site: { contacts: [] }, client })).toEqual([client.email]));
 it("does not redirect invalid inbound senders to another contact", () => expect(clientMailRecipients({ source: "email", emailFrom: "bad\nBcc: x@example.com", site, client })).toEqual([]));
 const order = { number: "LN-00537", title: '<img src=x onerror="bad">', scheduledAt: new Date("2026-09-24T10:00:00Z"), completionNote: "სამუშაო შესრულდა", amount: "118", vatPercent: "18", items: [{ name: "სერვისი", quantity: "1", unit: "ცალი", unitPrice: "100" }] };
 it.each(["received", "scheduled", "completed"] as const)("includes incident number and escapes HTML for %s", kind => {
  const mail = renderClientMail(kind, order, {});
  expect(mail.subject).toContain(order.number); expect(mail.text).toContain(order.number); expect(mail.html).toContain(order.number);
  expect(mail.html).not.toContain("<img"); expect(mail.html).toContain("&lt;img");
 });
 it("includes invoice lines and VAT only when charged", () => {
  expect(renderClientMail("completed", order, {}).html).toContain("დღგ 18%");
  expect(renderClientMail("completed", { ...order, vatPercent: "0" }, {}).html).not.toContain("დღგ");
 });
});

describe("real inbound sender formats", () => {
 it.each(["კლიენტი <sender@example.com>", '"Client, Name" <sender@example.com>', " sender@example.com "])("extracts one reply address from %s", emailFrom => {
  expect(clientMailRecipients({source:"email",emailFrom})).toEqual(["sender@example.com"]);
 });
 it.each(["a@example.com,b@example.com", "a@example.com; b@example.com", "A <a@example.com> B <b@example.com>", "A\r\nBcc:x@example.com <a@example.com>"])("rejects ambiguous or injected sender %s", emailFrom => {
  expect(clientMailRecipients({source:"email",emailFrom,client:{email:"other@example.com"}})).toEqual([]);
 });
 it("deduplicates opted-in contacts ignoring case and whitespace", () => {
  expect(clientMailRecipients({source:"portal",emailFrom:null,site:{contacts:[{email:" A@example.com ",receivesEmail:true},{email:"a@example.com",receivesEmail:true},{email:"private@example.com",receivesEmail:false}]}})).toEqual(["A@example.com"]);
 });
 it("falls back when all opted-in addresses are invalid", () => {
  expect(clientMailRecipients({source:"manual",emailFrom:null,client:{email:"office@example.com"},site:{contacts:[{email:"bad",receivesEmail:true}]}})).toEqual(["office@example.com"]);
 });
});
