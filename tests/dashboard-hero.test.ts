import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mock = vi.hoisted(() => ({ select: vi.fn(), queries: [] as { fields: unknown; where: unknown; table: unknown }[], results: [] as unknown[][] }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: { select: mock.select } }));
import { dashboardHeroMetrics } from "@/lib/dashboard-hero";
import { dashboardPeriod } from "@/lib/dashboard-period";
import { orders } from "@/db/schema";
import type { SessionUser } from "@/lib/session";
const period = dashboardPeriod("today", undefined, new Date("2026-09-24T08:00:00Z"));
beforeEach(() => {
  mock.queries.length = 0;
  mock.results = [];
  mock.select.mockReset().mockImplementation(fields => ({ from: (table: unknown) => ({ where: (where: unknown) => {
    mock.queries.push({ fields, table, where });
    const result = mock.results.shift() ?? [];
    return Object.assign(Promise.resolve(result), { groupBy: () => Promise.resolve(result) });
  } }) }));
});
describe("dashboard hero numbers", () => {
  it("totals completed gross amounts, remaining balances and actual payments", async () => {
    mock.results = [[{ count: 2, amount: 150, unpaid: 40 }], [{ bucket: 1, value: 60 }], [{ value: 30 }]];
    const result = await dashboardHeroMetrics({ role: "admin" } as SessionUser, period);
    expect(result).toMatchObject({ completed: 2, amount: 150, unpaid: 40, received: 60, previous: 30, changePct: 100 });
    expect(result.series[0].amount).toBe(0);
    expect(result.series[1].amount).toBe(60);
  });
  it("denies non-staff before querying", async () => {
    await expect(dashboardHeroMetrics({ role: "executor" } as SessionUser, period)).rejects.toThrow("Forbidden");
    expect(mock.select).not.toHaveBeenCalled();
  });
});
