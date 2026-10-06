import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), remove: vi.fn(),
  transaction: vi.fn(), values: vi.fn(), set: vi.fn(), where: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: m.select, insert: m.insert, update: m.update, delete: m.remove, transaction: m.transaction } }));
vi.mock("@/lib/session", () => ({ getSession: m.session }));
vi.mock("@/lib/systems", async () => {
  const { z } = await import("zod");
  return { systemSlug: z.string().refine(async slug => slug === "network", "კატეგორია ვერ მოიძებნა") };
});
import { createSubgroup, deleteSubgroup, moveSubgroup, renameSubgroup, setSubgroupActive } from "@/actions/subgroups";
import { listSubgroups, subgroupBelongs } from "@/lib/subgroups";
import { revalidatePath } from "next/cache";
const rows = [
  { id: 1, systemSlug: "network", name: "B", sort: 10, active: true },
  { id: 2, systemSlug: "network", name: "A", sort: 10, active: false },
  { id: 3, systemSlug: "network", name: "C", sort: 20, active: true },
];
function selection(value: unknown) { return { from: () => ({ where: () => Promise.resolve(value) }) }; }
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ user: { role: "admin" } });
  m.select.mockReturnValue(selection([...rows]));
  m.insert.mockReturnValue({ values: m.values });
  m.update.mockReturnValue({ set: m.set });
  m.set.mockReturnValue({ where: m.where });
  m.remove.mockReturnValue({ where: m.where });
});
describe("subgroups", () => {
  it("lists inactive and active subgroups ordered by sort then name", async () => {
    expect((await listSubgroups("network")).map(r => r.id)).toEqual([2, 1, 3]);
  });
  it("checks membership against both subgroup id and category", async () => {
    m.select.mockReturnValueOnce(selection([{ id: 1 }])).mockReturnValueOnce(selection([]));
    expect(await subgroupBelongs(1, "network")).toBe(true);
    expect(await subgroupBelongs(1, "camera")).toBe(false);
  });
  it.each(["manager", "executor", "client", null])("denies all mutations for %s", async role => {
    m.session.mockResolvedValue(role ? { user: { role } } : null);
    for (const result of [
      await createSubgroup("network", "კაბელები"), await renameSubgroup(1, "ახალი"),
      await setSubgroupActive(1, false), await moveSubgroup(1, "up"), await deleteSubgroup(1),
    ]) expect(result.ok).toBe(false);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("validates category and name before creating", async () => {
    expect((await createSubgroup("missing", "კაბელები")).ok).toBe(false);
    expect((await createSubgroup("network", " ")).ok).toBe(false);
    expect(m.insert).not.toHaveBeenCalled();
    expect(await createSubgroup("network", " კაბელები ")).toEqual({ ok: true });
    expect(m.values).toHaveBeenCalledWith({ systemSlug: "network", name: "კაბელები", sort: 30 });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/services");
  });
  it("renames and toggles only after validation", async () => {
    expect((await renameSubgroup(1, " ")).ok).toBe(false);
    expect((await setSubgroupActive(-1, true)).ok).toBe(false);
    expect(m.update).not.toHaveBeenCalled();
    await renameSubgroup(1, " ახალი ");
    expect(m.set).toHaveBeenCalledWith({ name: "ახალი" });
    await setSubgroupActive(1, false);
    expect(m.set).toHaveBeenLastCalledWith({ active: false });
  });
  it("moves within the parent category and handles boundaries", async () => {
    m.select.mockReturnValueOnce(selection([rows[0]])).mockReturnValueOnce(selection([...rows]));
    m.transaction.mockImplementation(async cb => cb({ update: m.update }));
    await moveSubgroup(1, "up");
    expect(m.set.mock.calls.map(call => call[0].sort)).toEqual([10, 20, 30]);
    expect(m.where).toHaveBeenCalledTimes(3);
    m.set.mockClear();
    m.select.mockReturnValueOnce(selection([rows[1]])).mockReturnValueOnce(selection([...rows]));
    await moveSubgroup(2, "up");
    expect(m.set).not.toHaveBeenCalled();
  });
  it.each([0, 1])("deletes only an empty subgroup (usage %s)", async usage => {
    const txSelect = vi.fn()
      .mockReturnValueOnce({ from: () => ({ where: () => ({ for: async () => [rows[0]] }) }) })
      .mockReturnValueOnce(selection([{ n: usage }]));
    m.transaction.mockImplementation(async cb => cb({ select: txSelect, delete: m.remove }));
    const result = await deleteSubgroup(1);
    expect(result).toEqual(usage ? { ok: false, error: "ჯერ სერვისები გადაიტანეთ" } : { ok: true });
    expect(m.remove).toHaveBeenCalledTimes(usage ? 0 : 1);
  });
});
