import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const { defaultPeriod, periodRange } = await import("@/lib/reports");

describe("report period", () => {
  it("defaults to the whole Tbilisi month, last day included", () => {
    expect(defaultPeriod(new Date("2026-09-24T10:00:00Z"))).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(defaultPeriod(new Date("2026-02-10T10:00:00Z"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("uses the Tbilisi day, not UTC, at the month edge", () => {
    // 21:00 UTC on 30 Sep is already 1 Oct in Tbilisi
    expect(defaultPeriod(new Date("2026-09-30T21:00:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("includes the whole last day", () => {
    const { start, end } = periodRange({ from: "2026-09-01", to: "2026-09-30" });
    expect(start.toISOString()).toBe("2026-08-31T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T20:00:00.000Z");
    const lateOn30th = new Date("2026-09-30T19:59:00Z"); // 23:59 Tbilisi
    expect(lateOn30th >= start && lateOn30th < end).toBe(true);
  });

  it("a single day covers that day", () => {
    const { start, end } = periodRange({ from: "2026-09-24", to: "2026-09-24" });
    expect(+end - +start).toBe(86_400_000);
  });
});
