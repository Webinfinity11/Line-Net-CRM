import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/notify", () => ({ notifyUsers: vi.fn() }));
import { planReminders, type ReminderOrder } from "@/lib/reminders";
import { tbilisiDayBounds, tbilisiToday } from "@/lib/schedule-utils";

const now = new Date("2026-09-24T04:00:00Z");
const people = [
  { id: "e", role: "executor", banned: false },
  { id: "m", role: "manager", banned: false },
  { id: "a", role: "admin", banned: false },
  { id: "c", role: "client", banned: false },
  { id: "b", role: "executor", banned: true },
  { id: "bm", role: "manager", banned: true },
];
const order = (overrides: Partial<ReminderOrder> = {}): ReminderOrder => ({
  id: 1, number: "LN-00001", title: "შემოწმება", status: "assigned", triaged: true,
  scheduledAt: new Date("2026-09-24T06:30:00Z"), dueDate: null, completedAt: null,
  managerId: "m", address: null, site: { name: "ოფისი", address: "თბილისი" }, assignees: [{ userId: "e" }], ...overrides,
});
const plan = (o: ReminderOrder) => planReminders([o], people, [], now);

describe("reminder selection", () => {
  it("uses Tbilisi midnight even while UTC is on the previous day", () => {
    expect(tbilisiToday(new Date("2026-09-23T20:00:00Z"))).toBe("2026-09-24");
    expect(tbilisiDayBounds("2026-09-24")).toEqual({ start: new Date("2026-09-23T20:00:00Z"), end: new Date("2026-09-24T20:00:00Z") });
  });
  it("sends today's visit to the assignee with local time and site", () => {
    expect(plan(order())).toEqual([{ userId: "e", type: "visit_today", title: "დღეს 10:30 — შემოწმება", body: "ოფისი · თბილისი", orderId: 1 }]);
  });
  it.each([
    ["2026-09-23T19:59:59Z", 0], ["2026-09-23T20:00:00Z", 1],
    ["2026-09-24T19:59:59Z", 1], ["2026-09-24T20:00:00Z", 0],
  ])("visit boundary %s yields %i reminders", (date, length) => {
    expect(plan(order({ scheduledAt: new Date(date) }))).toHaveLength(length);
  });
  it("requires triage and an assigned/in-progress visit", () => {
    expect(plan(order({ triaged: false }))).toEqual([]);
    for (const status of ["new", "done", "closed", "cancelled"] as const) expect(plan(order({ status }))).toEqual([]);
    expect(plan(order({ status: "in_progress" }))).toHaveLength(1);
  });
  it.each(["new", "assigned", "in_progress"] as const)("overdue %s goes to the owner and assignees", status => {
    const result = plan(order({ status, scheduledAt: null, dueDate: "2026-09-23" }));
    expect(result.map(n => n.userId)).toEqual(["m", "e"]);
    expect(result.every(n => n.type === "overdue" && n.title === "ვადა გავიდა: LN-00001")).toBe(true);
  });
  it("does not treat today's deadline, completed or cancelled orders as overdue", () => {
    expect(plan(order({ scheduledAt: null, dueDate: "2026-09-24" }))).toEqual([]);
    for (const status of ["done", "closed", "cancelled"] as const) expect(plan(order({ status, dueDate: "2026-09-23" })).filter(n => n.type === "overdue")).toEqual([]);
    expect(plan(order({ scheduledAt: null, dueDate: null }))).toEqual([]);
    expect(plan(order({ scheduledAt: null, dueDate: "2026-09-25" }))).toEqual([]);
  });
  it("uses all active staff only when the owner is empty", () => {
    expect(plan(order({ scheduledAt: null, dueDate: "2026-09-23", managerId: null })).map(n => n.userId)).toEqual(["m", "a", "e"]);
    expect(plan(order({ scheduledAt: null, dueDate: "2026-09-23", managerId: "bm" })).map(n => n.userId)).toEqual(["e"]);
  });
  it("waits strictly more than three days without a deadline, and only reminds staff", () => {
    expect(plan(order({ status: "done", completedAt: new Date("2026-09-21T04:00:00Z") }))).toEqual([]);
    const result = plan(order({ status: "done", completedAt: new Date("2026-09-21T03:59:59Z"), managerId: null }));
    expect(result.map(n => n.userId)).toEqual(["m", "a"]);
    expect(result.every(n => n.type === "done_waiting")).toBe(true);
    expect(plan(order({ status: "closed", completedAt: new Date("2026-09-20") }))).toEqual([]);
  });
  it.each([
    ["2026-09-25", 0], ["2026-09-24", 0], ["2026-09-23", 1],
  ])("done deadline %s yields %i reminders even after four days", (dueDate, length) => {
    expect(plan(order({ status: "done", dueDate, completedAt: new Date("2026-09-20T04:00:00Z") }))).toHaveLength(length);
  });
  it("an expired done deadline does not require waiting three more days", () => {
    expect(plan(order({ status: "done", dueDate: "2026-09-23", completedAt: new Date("2026-09-24T03:00:00Z") })).map(n => n.type)).toEqual(["done_waiting"]);
  });
  it.each([[2, 0], [4, 1]])("done without a deadline after %i days yields %i reminders", (days, length) => {
    expect(plan(order({ status: "done", dueDate: null, completedAt: new Date(now.getTime() - days * 86_400_000) }))).toHaveLength(length);
  });
  it("does not remind an undated done order without a completion timestamp", () => {
    expect(plan(order({ status: "done", dueDate: null, completedAt: null }))).toEqual([]);
  });
  it("excludes client/banned/unknown accounts even when assigned", () => {
    expect(plan(order({ assignees: ["e", "c", "b", "missing"].map(userId => ({ userId })) })).map(n => n.userId)).toEqual(["e"]);
    expect(plan(order({ status: "done", completedAt: new Date("2026-09-20"), managerId: "c" }))).toEqual([]);
  });
  it("deduplicates visits per user/order/Tbilisi day regardless of read status", () => {
    const previous = { userId: "e", type: "visit_today", orderId: 1, createdAt: new Date("2026-09-23T20:00:00Z") };
    expect(planReminders([order()], people, [previous], now)).toEqual([]);
    expect(planReminders([order()], people, [{ ...previous, createdAt: new Date("2026-09-23T19:59:59Z") }], now)).toHaveLength(1);
    expect(planReminders([order({ id: 2 })], people, [previous], now)).toHaveLength(1);
  });
  it.each(["overdue", "done_waiting"] as const)("deduplicates %s for all time, per recipient", type => {
    const o = order({ scheduledAt: null, dueDate: "2026-09-23", status: type === "overdue" ? "assigned" : "done", completedAt: new Date("2026-09-20") });
    const result = planReminders([o], people, [{ userId: "m", type, orderId: 1, createdAt: new Date("2020-01-01") }], now);
    expect(result.map(n => n.userId)).toEqual(type === "overdue" ? ["e"] : []);
  });
  it("deduplicates overlapping manager and assignee recipients", () => {
    expect(plan(order({ scheduledAt: null, dueDate: "2026-09-23", assignees: [{ userId: "m" }, { userId: "m" }] }))).toHaveLength(1);
  });
});
