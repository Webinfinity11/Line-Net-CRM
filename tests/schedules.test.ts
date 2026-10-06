import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), notify: vi.fn(), checklist: vi.fn() }));
vi.mock("@/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/notify", () => ({ notifyUsers: mocks.notify }));
vi.mock("@/lib/checklists", () => ({ applyDefaultChecklist: mocks.checklist }));
import { advance, generateDueOrders } from "@/lib/schedules";

describe("advance", () => {
  it("clamps month steps to the end of a shorter month", () => {
    expect(advance("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advance("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(advance("2026-03-31", "monthly")).toBe("2026-04-30");
    expect(advance("2026-05-31", "quarterly")).toBe("2026-08-31");
    expect(advance("2026-08-31", "semiannual")).toBe("2027-02-28");
    expect(advance("2024-02-29", "annual")).toBe("2025-02-28");
  });
  it("keeps ordinary days and crosses the year", () => {
    expect(advance("2026-01-15", "monthly")).toBe("2026-02-15");
    expect(advance("2026-12-10", "monthly")).toBe("2027-01-10");
    expect(advance("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(advance("2026-09-24", "annual")).toBe("2027-09-24");
  });
  it("adds seven days for weekly", () => {
    expect(advance("2026-12-28", "weekly")).toBe("2027-01-04");
  });
});

describe("generateDueOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing while another run holds the lock", async () => {
    const findMany = vi.fn();
    const tx = { execute: vi.fn().mockResolvedValue({ rows: [{ locked: false }] }), query: { serviceSchedules: { findMany } } };
    mocks.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    expect(await generateDueOrders("u")).toEqual({ created: 0, skipped: 0, ids: [] });
    expect(findMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
