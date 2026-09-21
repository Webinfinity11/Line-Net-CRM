import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), company: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn(),
  where: vi.fn(), notify: vi.fn(), geocode: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/portal", () => ({ portalCompanyOf: mocks.company }));
vi.mock("@/lib/notify", () => ({ notifyUsers: mocks.notify, staffUserIds: async () => ["admin", "manager"] }));
vi.mock("@/lib/geocode", () => ({ geocodeAddress: mocks.geocode }));
vi.mock("@/lib/systems", () => ({ systemSlug: { nullable: () => ({}) } }));
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update, insert: mocks.insert } }));

import { createPortalSite, updatePortalSite } from "@/actions/portal";

function form() {
  const fd = new FormData();
  fd.set("name", "ფილიალი");
  fd.set("address", "თბილისი");
  fd.set("clientId", "99"); // Untrusted ownership must be ignored.
  return fd;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "client-user", role: "client" } });
  mocks.company.mockResolvedValue({ id: 40, name: "კომპანია" });
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.geocode.mockResolvedValue(null);
});

describe("portal site ownership", () => {
  it("rejects a site outside the session company before any mutation or geocoding", async () => {
    mocks.where.mockResolvedValue([]);
    const result = await updatePortalSite(999, form());
    expect(result.ok).toBe(false);
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"sites"."client_id"');
    expect(query.params).toEqual([999, 40]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.geocode).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("derives create ownership from the session and not form clientId", async () => {
    const row = { id: 7, name: "ფილიალი", address: "თბილისი", contactName: null, contactPhone: null };
    const values = vi.fn((_: unknown) => ({ returning: async () => [row] }));
    mocks.insert.mockReturnValue({ values });
    expect((await createPortalSite(form())).ok).toBe(true);
    expect(values.mock.calls[0][0]).toMatchObject({ clientId: 40 });
    expect(mocks.notify).toHaveBeenCalledWith(["admin", "manager"], {
      type: "portal", title: "კომპანია: დაემატა მისამართი", body: "ფილიალი · თბილისი",
    });
  });

  it("scopes the update as well and preserves coordinates when the address is unchanged", async () => {
    mocks.where.mockResolvedValue([{ address: "თბილისი", lat: "41.7000000", lng: "44.8000000" }]);
    const row = { id: 7, name: "ფილიალი", address: "თბილისი", contactName: null, contactPhone: null };
    const updateWhere = vi.fn((_: SQL) => ({ returning: async () => [row] }));
    const set = vi.fn((_: unknown) => ({ where: updateWhere }));
    mocks.update.mockReturnValue({ set });
    expect((await updatePortalSite(7, form())).ok).toBe(true);
    expect(new PgDialect().sqlToQuery(updateWhere.mock.calls[0][0]).params).toEqual([7, 40]);
    expect(set.mock.calls[0][0]).toMatchObject({ lat: "41.7000000", lng: "44.8000000" });
    expect(set.mock.calls[0][0]).not.toHaveProperty("clientId");
    expect(mocks.geocode).not.toHaveBeenCalled();
  });

  it.each([null, { user: { id: "staff", role: "admin" } }])("rejects a non-client session", async (session) => {
    mocks.session.mockResolvedValue(session);
    expect((await createPortalSite(form())).ok).toBe(false);
    expect((await updatePortalSite(7, form())).ok).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
