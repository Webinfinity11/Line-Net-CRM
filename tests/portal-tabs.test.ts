import { describe, expect, it } from "vitest";
import { countPortalTabs, parsePortalTab, portalTabOf, PORTAL_TABS } from "@/lib/portal-tabs";

const cases = [
  ["new", "planned"], ["assigned", "planned"], ["in_progress", "progress"],
  ["done", "done"], ["closed", "done"], ["cancelled", "cancelled"],
] as const;

describe("portal tabs", () => {
  it.each(cases)("maps triaged %s to %s", (status, expected) => {
    expect(portalTabOf(status, true)).toBe(expected);
  });
  it.each(cases)("keeps untriaged %s in sent", (status) => {
    expect(portalTabOf(status, false)).toBe("sent");
  });
  it("counts every row exactly once, merging done and closed", () => {
    const rows = cases.flatMap(([status]) => [{ status, triaged: true }, { status, triaged: false }]);
    expect(countPortalTabs(rows)).toEqual({ all: 12, sent: 6, planned: 2, progress: 1, done: 2, cancelled: 1 });
  });
  it("returns zero counts for an empty filtered result", () => {
    expect(countPortalTabs([])).toEqual({ all: 0, sent: 0, planned: 0, progress: 0, done: 0, cancelled: 0 });
  });
  it.each(PORTAL_TABS)("accepts $key", ({ key }) => expect(parsePortalTab(key)).toBe(key));
  it.each([undefined, "", "unknown", "DONE", "__proto__"])("defaults invalid %s to all", (value) => {
    expect(parsePortalTab(value)).toBe("all");
  });
});
