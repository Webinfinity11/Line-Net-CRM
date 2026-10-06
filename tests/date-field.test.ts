import { describe, expect, it } from "vitest";
import { dateAllowed, dateKey, formatFieldDate, joinDateTime, monthGrid, parseDate, shiftMonth, tbilisiDate, TIME_OPTIONS, validTime } from "@/lib/date-field";

describe("calendar values", () => {
  it("strictly parses calendar days, including leap years", () => {
    expect(dateKey(parseDate("2024-02-29")!)).toBe("2024-02-29");
    for (const value of ["2025-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "0000-01-01", "2026-9-01", "", "2026-09-24T12:00"]) {
      expect(parseDate(value)).toBeNull();
    }
  });
  it("renders the existing dot-separated date style without timezone conversion", () => {
    expect(formatFieldDate("2026-09-24")).toBe("24.09.2026");
    expect(formatFieldDate("invalid")).toBe("");
    expect(formatFieldDate("2026-02-30")).toBe("");
  });
  it("starts the six-week grid on Monday, including adjacent months", () => {
    const days = monthGrid("2026-09-24");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-08-31");
    expect(days[41]).toBe("2026-10-11");
    expect(new Set(days).size).toBe(42);
    expect(monthGrid("2026-02-01")).toContain("2026-02-28");
    expect(monthGrid("2024-02-01")).toContain("2024-02-29");
    expect(monthGrid("2026-06-01")[0]).toBe("2026-06-01");
    expect(monthGrid("invalid")).toEqual([]);
  });
  it("navigates months from month-end across year boundaries", () => {
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("enforces inclusive minimum and maximum days", () => {
    expect(dateAllowed("2026-09-24", "2026-09-24", "2026-09-24")).toBe(true);
    expect(dateAllowed("2026-09-23", "2026-09-24")).toBe(false);
    expect(dateAllowed("2026-09-25", undefined, "2026-09-24")).toBe(false);
    expect(dateAllowed("2026-02-30")).toBe(false);
  });
  it("uses Tbilisi's day at UTC midnight boundaries", () => {
    expect(tbilisiDate(new Date("2026-09-24T19:59:59Z"))).toBe("2026-09-24");
    expect(tbilisiDate(new Date("2026-09-24T20:00:00Z"))).toBe("2026-09-25");
  });
});

describe("time values and form serialization", () => {
  it("offers each quarter hour between 07:00 and 21:00 inclusive", () => {
    expect(TIME_OPTIONS).toHaveLength(57);
    expect(TIME_OPTIONS.slice(0, 5)).toEqual(["07:00", "07:15", "07:30", "07:45", "08:00"]);
    expect(TIME_OPTIONS.at(-1)).toBe("21:00");
    expect(TIME_OPTIONS.every(validTime)).toBe(true);
  });
  it("allows manually entered times outside the suggestions and off the quarter hour", () => {
    for (const value of ["00:00", "06:17", "23:59"]) expect(validTime(value)).toBe(true);
    for (const value of ["24:00", "12:60", "9:00", "09:0", "", "abc"]) expect(validTime(value)).toBe(false);
  });
  it("preserves datetime-local's wire format without applying a timezone", () => {
    expect(joinDateTime("2026-09-24", "09:15")).toBe("2026-09-24T09:15");
    expect(joinDateTime("", "09:15")).toBe("");
    expect(joinDateTime("2026-09-24", "")).toBe("");
    expect(joinDateTime("2026-02-30", "09:15")).toBe("");
    expect(joinDateTime("2026-09-24", "24:00")).toBe("");
  });
});
