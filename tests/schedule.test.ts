import { describe, expect, it } from "vitest";
import { findOverlaps, formatMinutes, layoutLane, minutesIntoDay, plannedEnd, tbilisiDayBounds, workload, type Slot } from "@/lib/schedule-utils";

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

describe("lane layout", () => {
  it("keeps non-overlapping jobs in one full-width column", () => {
    const p = layoutLane([
      { id: 1, start: at(9), end: at(10) },
      { id: 2, start: at(10), end: at(11) },
    ]);
    expect(p).toEqual([
      { id: 1, col: 0, cols: 1 },
      { id: 2, col: 0, cols: 1 },
    ]);
  });
  it("places overlapping jobs side by side and reuses freed columns", () => {
    const p = layoutLane([
      { id: 1, start: at(9), end: at(11) },
      { id: 2, start: at(10), end: at(12) },
      { id: 3, start: at(11), end: at(13) }, // fits back into column 0 after job 1 ends
      { id: 4, start: at(14), end: at(15) }, // new cluster
    ]);
    expect(p.find((x) => x.id === 1)).toEqual({ id: 1, col: 0, cols: 2 });
    expect(p.find((x) => x.id === 2)).toEqual({ id: 2, col: 1, cols: 2 });
    expect(p.find((x) => x.id === 3)).toEqual({ id: 3, col: 0, cols: 2 });
    expect(p.find((x) => x.id === 4)).toEqual({ id: 4, col: 0, cols: 1 });
  });
  it("formats minutes and measures minutes into the Tbilisi day", () => {
    const { start } = tbilisiDayBounds("2026-09-16");
    expect(minutesIntoDay(at(10, 15), start)).toBe(615);
    expect(formatMinutes(615)).toBe("10:15");
    expect(formatMinutes(0)).toBe("00:00");
  });
});
