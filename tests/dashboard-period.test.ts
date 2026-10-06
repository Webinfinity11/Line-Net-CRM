import { describe, expect, it } from "vitest";
import { dashboardBuckets, dashboardPeriod, validDashboardDay } from "@/lib/dashboard-period";

describe("dashboard period windows", () => {
  const now = new Date("2026-09-24T08:30:00Z");
  it("uses Tbilisi midnight and yesterday to the same instant", () => {
    const p = dashboardPeriod("today", undefined, now);
    expect(p.start.toISOString()).toBe("2026-09-23T20:00:00.000Z");
    expect(p.previousEnd.toISOString()).toBe("2026-09-23T08:30:00.000Z");
    const b = dashboardBuckets(p);
    expect(b).toHaveLength(13);
    expect(b[0].label).toBe("00:00");
    expect(b.at(-1)?.end).toEqual(now);
  });
  it("returns seven daily buckets, including today", () => {
    const p = dashboardPeriod("week", undefined, now);
    expect(dashboardBuckets(p)).toHaveLength(7);
    expect(+p.start - +p.previousStart).toBe(7 * 86400000);
    expect(+p.end - +p.previousEnd).toBe(7 * 86400000);
  });
  it("compares calendar months and clamps a shorter previous month", () => {
    const p = dashboardPeriod("month", undefined, new Date("2024-03-31T08:00:00Z"));
    expect(p.start.toISOString()).toBe("2024-02-29T20:00:00.000Z");
    expect(p.previousStart.toISOString()).toBe("2024-01-31T20:00:00.000Z");
    expect(p.previousEnd).toEqual(p.start);
    expect(dashboardBuckets(p)).toHaveLength(31);
    const jan = dashboardPeriod("month", undefined, new Date("2026-01-03T21:00:00Z"));
    expect(jan.previousEnd.toISOString()).toBe("2025-12-03T21:00:00.000Z");
  });
  it("includes the whole custom end day and compares the same number of days", () => {
    const p = dashboardPeriod("week", { from: "2026-09-01", to: "2026-09-03" }, now);
    expect(p.end.toISOString()).toBe("2026-09-03T20:00:00.000Z");
    expect(p.previousEnd).toEqual(p.start);
    expect(+p.start - +p.previousStart).toBe(+p.end - +p.start);
    expect(dashboardBuckets(p)).toHaveLength(3);
  });
  it("groups over 45 days into weeks, keeping the final partial week", () => {
    const p = dashboardPeriod("week", { from: "2026-01-01", to: "2026-02-15" }, now);
    const buckets = dashboardBuckets(p);
    expect(buckets).toHaveLength(7);
    expect(buckets.at(-1)?.end).toEqual(p.end);
    expect(dashboardPeriod("week", { from: "2026-01-01", to: "2026-02-14" }, now).step).toBe(86400000);
  });
  it("rejects impossible dates", () => {
    expect(validDashboardDay("2026-02-30")).toBe(false);
    expect(validDashboardDay("2024-02-29")).toBe(true);
    expect(validDashboardDay(["2026-01-01"])).toBe(false);
  });
});
