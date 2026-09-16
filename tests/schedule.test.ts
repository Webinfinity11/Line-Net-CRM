import { describe, expect, it } from "vitest";
import { findOverlaps, plannedEnd, tbilisiDayBounds, workload, type Slot } from "@/lib/schedule-utils";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 16, h - 4, m)); // 2026-09-16 Tbilisi (UTC+4)

describe("overlap detection", () => {
  it("flags two jobs of the same executor that overlap", () => {
    const slots: Slot[] = [
      { id: 1, userId: "u1", start: at(10), end: plannedEnd(at(10), 120) },
      { id: 2, userId: "u1", start: at(11), end: plannedEnd(at(11), 60) },
    ];
    const o = findOverlaps(slots);
    expect(o.get(1)).toEqual([2]);
    expect(o.get(2)).toEqual([1]);
  });
  it("does not flag back-to-back jobs or other executors", () => {
    const slots: Slot[] = [
      { id: 1, userId: "u1", start: at(10), end: at(12) },
      { id: 2, userId: "u1", start: at(12), end: at(13) },
      { id: 3, userId: "u2", start: at(10, 30), end: at(11) },
    ];
    expect(findOverlaps(slots).size).toBe(0);
  });
});

describe("workload by planned hours", () => {
  it("uses the configurable daily norm", () => {
    expect(workload(240, 8)).toEqual({ pct: 50, hours: 4, over: false });
    expect(workload(600, 8)).toEqual({ pct: 100, hours: 10, over: true });
    expect(workload(240, 6)).toEqual({ pct: 67, hours: 4, over: false });
  });
});

describe("Tbilisi day bounds", () => {
  it("covers 00:00–24:00 local (UTC+4)", () => {
    const { start, end } = tbilisiDayBounds("2026-09-16");
    expect(start.toISOString()).toBe("2026-09-15T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-16T20:00:00.000Z");
  });
});
