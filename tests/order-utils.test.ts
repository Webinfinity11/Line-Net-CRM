import { describe, expect, it } from "vitest";
import { addMonthsIso, isOverdue, minutesBetween, orderContact, telHref } from "@/lib/order-utils";

describe("order utils", () => {
  it("warranty end adds months in Tbilisi time", () => {
    expect(addMonthsIso("2026-01-31T10:00:00+04:00", 12)).toBe("2027-01-31");
  });
  it("overdue only for unfinished orders with a past due date", () => {
    expect(isOverdue({ dueDate: "2000-01-01", status: "assigned" })).toBe(true);
    expect(isOverdue({ dueDate: "2000-01-01", status: "closed" })).toBe(false);
    expect(isOverdue({ dueDate: null, status: "assigned" })).toBe(false);
  });
  it("the branch contact wins over the company contact", () => {
    const client = { name: "შპს ტესტ-მარკეტი", contactName: "ნიკა", phone: "577112233" };
    expect(orderContact({ client, site: { contactName: "გიგა", contactPhone: "577112234" } })).toEqual({ name: "გიგა", phone: "577112234", onSite: true });
    expect(orderContact({ client, site: { contactName: null, contactPhone: null } })).toEqual({ name: "ნიკა", phone: "577112233", onSite: false });
    // a branch that only has a number still borrows the company contact's name
    expect(orderContact({ client, site: { contactPhone: "577112235" } })).toEqual({ name: "ნიკა", phone: "577112235", onSite: true });
    expect(orderContact({ client: null, site: null })).toEqual({ name: "—", phone: null, onSite: false });
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
