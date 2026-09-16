import { describe, expect, it } from "vitest";
import { addMonthsIso, isOverdue, minutesBetween } from "@/lib/order-utils";

describe("order utils", () => {
  it("warranty end adds months in Tbilisi time", () => {
    expect(addMonthsIso("2026-01-31T10:00:00+04:00", 12)).toBe("2027-01-31");
  });
  it("overdue only for unfinished orders with a past due date", () => {
    expect(isOverdue({ dueDate: "2000-01-01", status: "assigned" })).toBe(true);
    expect(isOverdue({ dueDate: "2000-01-01", status: "closed" })).toBe(false);
    expect(isOverdue({ dueDate: null, status: "assigned" })).toBe(false);
  });
  it("visit minutes", () => {
    expect(minutesBetween("2026-09-16T10:00:00Z", "2026-09-16T11:30:00Z")).toBe(90);
    expect(minutesBetween("2026-09-16T10:00:00Z", null)).toBeNull();
  });
});
