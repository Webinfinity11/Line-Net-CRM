import { describe, expect, it } from "vitest";
import { addMonthsIso, isOverdue, minutesBetween, orderContact, telHref, toLocalInput, todayIso } from "@/lib/order-utils";

describe("order utils", () => {
  it("warranty end adds months in Tbilisi time", () => {
    expect(addMonthsIso("2026-01-31T10:00:00+04:00", 12)).toBe("2027-01-31");
  });
  it("overdue only for unfinished orders with a past due date", () => {
    expect(isOverdue({ dueDate: "2000-01-01", status: "assigned" })).toBe(true);
    expect(isOverdue({ dueDate: "2000-01-01", status: "closed" })).toBe(false);
    expect(isOverdue({ dueDate: null, status: "assigned" })).toBe(false);
  });
  it("today and overdue follow the Tbilisi day, not the server's", () => {
    // 23:00 UTC is already 03:00 of the next day in Tbilisi
    const now = new Date("2026-09-23T23:00:00Z");
    expect(todayIso(now)).toBe("2026-09-24");
    expect(isOverdue({ dueDate: "2026-09-23", status: "assigned" }, now)).toBe(true);
    expect(isOverdue({ dueDate: "2026-09-24", status: "assigned" }, now)).toBe(false);
    expect(todayIso(new Date("2026-09-23T19:59:00Z"))).toBe("2026-09-23");
    expect(todayIso(new Date("2026-09-23T20:00:00Z"))).toBe("2026-09-24");
  });
  it("field value shows Tbilisi time", () => {
    expect(toLocalInput("2026-09-23T23:00:00Z")).toBe("2026-09-24T03:00");
    expect(toLocalInput("2026-09-23T20:00:00Z")).toBe("2026-09-24T00:00");
    expect(toLocalInput("2026-09-24T06:15:00Z")).toBe("2026-09-24T10:15");
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("nonsense")).toBe("");
  });
  it("the branch contact wins over the company contact", () => {
    const client = { name: "შპს ტესტ-მარკეტი", contactName: "ნიკა", phone: "577112233" };
    expect(orderContact({ client, site: { contactName: "გიგა", contactPhone: "577112234" } })).toEqual({ name: "გიგა", phone: "577112234", onSite: true, namedOnSite: true });
    expect(orderContact({ client, site: { contactName: null, contactPhone: null } })).toEqual({ name: "ნიკა", phone: "577112233", onSite: false, namedOnSite: false });
    // a branch that only has a number still borrows the company contact's name
    expect(orderContact({ client, site: { contactPhone: "577112235" } })).toEqual({ name: "ნიკა", phone: "577112235", onSite: true, namedOnSite: false });
    expect(orderContact({ client: null, site: null })).toEqual({ name: "—", phone: null, onSite: false, namedOnSite: false });
  });
  it("tel links keep digits only", () => {
    expect(telHref("577 11 22 33")).toBe("tel:577112233");
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
  it("visit minutes", () => {
    expect(minutesBetween("2026-09-16T10:00:00Z", "2026-09-16T11:30:00Z")).toBe(90);
    expect(minutesBetween("2026-09-16T10:00:00Z", null)).toBeNull();
  });
});
