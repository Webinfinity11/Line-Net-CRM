import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn() }));

import { PORTAL_STATUS_LABELS, portalStatusLabel } from "@/lib/i18n";
import { shouldNotifyPortalAcceptance } from "@/lib/portal";
import type { OrderStatus } from "@/db/schema";

describe("portal status", () => {
  it("shows sent until triaged, then accepted", () => {
    expect(portalStatusLabel("new", false)).toBe("გაგზავნილია");
    expect(portalStatusLabel("new", true)).toBe("მიღებულია");
  });
  it.each(Object.keys(PORTAL_STATUS_LABELS) as OrderStatus[])("keeps the normal label for triaged %s", (status) => {
    expect(portalStatusLabel(status, true)).toBe(PORTAL_STATUS_LABELS[status]);
    expect(portalStatusLabel(status, false)).toBe("გაგზავნილია");
  });
});

describe("portal acceptance notification", () => {
  for (const source of ["portal", "email", "manual"]) {
    for (const before of [false, true]) {
      for (const after of [false, true]) {
        it(`${source}: ${before} → ${after}`, () => {
          expect(shouldNotifyPortalAcceptance(source, before, after)).toBe(source === "portal" && !before && after);
        });
      }
    }
  }
});
