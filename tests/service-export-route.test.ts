import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(), isStaff: (role: string) => ["admin", "manager"].includes(role) }));
vi.mock("@/lib/services", () => ({ listServices: vi.fn() }));
vi.mock("@/lib/systems", () => ({ listSystems: vi.fn(), systemLabels: vi.fn() }));
vi.mock("@/lib/reports", () => ({
  defaultPeriod: () => ({ from: "2026-09-01", to: "2026-09-30" }), ordersForExport: vi.fn(),
  clientsForExport: vi.fn(), reportByClient: vi.fn(), reportByExecutor: vi.fn(), reportBySystem: vi.fn(), reportMonthly: vi.fn(),
}));
import { getSession } from "@/lib/session";
import { listServices } from "@/lib/services";
import { listSystems, systemLabels } from "@/lib/systems";
import { ordersForExport } from "@/lib/reports";
import { GET } from "@/app/api/export/route";

const as = (role: string) => vi.mocked(getSession).mockResolvedValue({ user: { id: "test", role } } as Awaited<ReturnType<typeof getSession>>);
const read = async (response: Response) => XLSX.read(await response.arrayBuffer(), { type: "array" });

describe("grouped export authorization and contents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    as("manager");
    vi.mocked(listSystems).mockResolvedValue([
      { key: "network", name: "ქსელი", color: null, sort: 0, active: true },
      { key: "camera", name: "კამერები", color: null, sort: 1, active: true },
    ]);
    vi.mocked(systemLabels).mockResolvedValue({ network: "ქსელი", camera: "კამერები" });
    vi.mocked(listServices).mockResolvedValue([
      { id: 1, name: "HDMI", systemType: "network", subgroupId: 7, subgroupName: "კაბელები", unit: "მეტრი", price: "12.50", active: true, description: null, sort: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: "ძველი კამერა", systemType: "camera", subgroupId: null, subgroupName: null, unit: "ცალი", price: "0.00", active: false, description: null, sort: 0, createdAt: new Date(), updatedAt: new Date() },
    ]);
  });
  it.each(["executor", "client"])("denies %s before reading financial data", async role => {
    as(role);
    expect((await GET(new Request("http://localhost/api/export?type=services"))).status).toBe(403);
    expect(listServices).not.toHaveBeenCalled();
  });
  it("denies anonymous requests", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/export?type=services"))).status).toBe(403);
  });
  it.each(["admin", "manager"])("exports all catalogue records including inactive services for %s", async role => {
    as(role);
    const response = await GET(new Request("http://localhost/api/export?type=services"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const wb = await read(response);
    expect(wb.SheetNames).toEqual(["სარჩევი", "ქსელი", "კამერები"]);
    expect(wb.Sheets["ქსელი"].D4.v).toBe("ქვეჯგუფი");
    expect(wb.Sheets["ქსელი"].D5.v).toBe("კაბელები");
    expect(wb.Sheets["კამერები"].D5.v).toBe("ქვეჯგუფის გარეშე");
    expect(wb.Sheets["ქსელი"].E5.v).toBe("მეტრი");
    expect(wb.Sheets["კამერები"].G5.v).toBe("არააქტიური");
    expect(wb.Sheets["კამერები"].F5.v).toBe(0);
  });
  it("applies the current search and category filter", async () => {
    const wb = await read(await GET(new Request("http://localhost/api/export?type=services&q=hdmi&cat=network")));
    expect(wb.SheetNames).toEqual(["სარჩევი", "ქსელი"]);
    expect(wb.Sheets["ქსელი"].B5.v).toBe("HDMI");
  });
  it("filters by subgroup name and sorts within the category", async () => {
    const existing = await listServices();
    vi.mocked(listServices).mockResolvedValue([
      { ...existing[0], id: 3, name: "Z კაბელი" },
      { ...existing[0], id: 4, name: "A კაბელი" },
      { ...existing[0], id: 5, name: "სხვა", subgroupId: null, subgroupName: null },
    ]);
    const wb = await read(await GET(new Request("http://localhost/api/export?type=services&q=" + encodeURIComponent("კაბელები"))));
    expect(wb.SheetNames).toEqual(["სარჩევი", "ქსელი"]);
    expect(wb.Sheets["ქსელი"].B5.v).toBe("A კაბელი");
    expect(wb.Sheets["ქსელი"].B6.v).toBe("Z კაბელი");
    expect(wb.Sheets["ქსელი"].B7).toBeUndefined();
  });
  it("groups order exports while preserving the date range and existing columns", async () => {
    const base = { number: "LN-1", title: "მონტაჟი", status: "assigned", type: "service", priority: "normal", amount: "50.00", paidTotal: "10.00", paymentStatus: "partial", assignees: [], materials: [], visits: [], source: "manual" };
    vi.mocked(ordersForExport).mockResolvedValue([
      { ...base, systemType: "camera" }, { ...base, number: "LN-2", systemType: null },
    ] as unknown as Awaited<ReturnType<typeof ordersForExport>>);
    const wb = await read(await GET(new Request("http://localhost/api/export?type=orders&from=2026-08-01&to=2026-08-31")));
    expect(ordersForExport).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-31" });
    expect(wb.SheetNames).toEqual(["სარჩევი", "კამერები", "კატეგორიის გარეშე"]);
    expect(wb.Sheets["კამერები"].Q5.v).toBe(50);
    expect(wb.Sheets["კამერები"].S5.v).toBe(40);
    expect(wb.Sheets["კატეგორიის გარეშე"].A5.v).toBe("LN-2");
    await GET(new Request("http://localhost/api/export?type=orders&all=1"));
    expect(ordersForExport).toHaveBeenLastCalledWith(null);
  });
});
