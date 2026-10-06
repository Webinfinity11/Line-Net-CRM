import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { filterServiceCatalogue, groupByServiceCategory, groupByServiceSubgroup, NO_SUBGROUP } from "@/lib/service-groups";
import { groupedExcelWorkbook } from "@/lib/grouped-excel";

const categories = [{ key: "camera", name: "ვიდეოკონტროლი" }, { key: "network", name: "ქსელი" }];
const labels = Object.fromEntries(categories.map(c => [c.key, c.name]));
const items = [
  { id: 1, name: "HDMI კაბელი", description: null, systemType: "network" },
  { id: 2, name: "კამერა", description: "HDMI გამოსასვლელით", systemType: "camera" },
  { id: 3, name: "უსადენო ქსელი", description: null, systemType: "network" },
  { id: 4, name: "არქივი", description: null, systemType: "removed" },
  { id: 5, name: "კონსულტაცია", description: null, systemType: null },
];

describe("service export groups and screen filters", () => {
  it("uses catalogue order, preserves item order, and keeps unknown/uncategorized items", () => {
    const groups = groupByServiceCategory(items, categories);
    expect(groups.map(g => g.name)).toEqual(["ვიდეოკონტროლი", "ქსელი", "კატეგორიის გარეშე"]);
    expect(groups.map(g => g.items.map(i => i.id))).toEqual([[2], [1, 3], [4, 5]]);
  });
  it("searches names and descriptions without case sensitivity", () => {
    expect(filterServiceCatalogue(items, labels, { q: " hdmi " }).map(i => i.id)).toEqual([1, 2]);
  });
  it("searches category labels and intersects search with the chosen category", () => {
    expect(filterServiceCatalogue(items, labels, { q: "ვიდეოკონტროლი" }).map(i => i.id)).toEqual([2]);
    expect(filterServiceCatalogue(items, labels, { q: "HDMI", cat: "network" }).map(i => i.id)).toEqual([1]);
    expect(filterServiceCatalogue(items, labels, { cat: "none" }).map(i => i.id)).toEqual([4, 5]);
    expect(filterServiceCatalogue(items, labels, { cat: "missing" })).toEqual([]);
  });
});

describe("saved grouped Excel workbook", () => {
  const columns = [{ label: "დასახელება", width: 45 }, { label: "ფასი", width: 20, format: '#,##0.00 "₾"' }];
  const save = (groups: { name: string; rows: (string | number)[][] }[]) => XLSX.read(XLSX.write(groupedExcelWorkbook({
    title: "სერვისები", context: "ყველა კატეგორია", columns, groups,
  }), { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellNF: true });

  it("round-trips category separation, prices (including zero), headers, filters and directory links", () => {
    const wb = save([{ name: "ქსელი", rows: [["HDMI", 12.5], ["უფასო", 0]] }, { name: "კამერები", rows: [["მონტაჟი", 100]] }]);
    expect(wb.SheetNames).toEqual(["სარჩევი", "ქსელი", "კამერები"]);
    const ws = wb.Sheets["ქსელი"];
    expect(ws.A4.v).toBe("დასახელება");
    expect(ws.A5.v).toBe("HDMI");
    expect(ws.B5).toMatchObject({ t: "n", v: 12.5, z: '#,##0.00 "₾"' });
    expect(ws.B6.v).toBe(0);
    expect(ws["!autofilter"]?.ref).toBe("A4:B6");
    expect(wb.Sheets["სარჩევი"].B5.v).toBe(2);
    expect(wb.Sheets["სარჩევი"].B7.v).toBe(3);
    expect(wb.Sheets["სარჩევი"].C5.l?.Target).toBe("#'ქსელი'!A1");
  });

  it("handles duplicate, forbidden, reserved and long sheet names without losing groups", () => {
    const names = ["სარჩევი", "History", "history", "A/B", "A:B", "'Quote'", "Long ".repeat(12), "Long ".repeat(12) + "2", ""];
    const wb = save(names.map((name, i) => ({ name, rows: [[`item-${i}`, i]] })));
    expect(wb.SheetNames).toHaveLength(names.length + 1);
    expect(new Set(wb.SheetNames.map(n => n.toLowerCase())).size).toBe(names.length + 1);
    wb.SheetNames.forEach(name => {
      expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[\\/?*\[\]:]/);
      expect(name.toLowerCase()).not.toBe("history");
    });
    expect(wb.SheetNames.slice(1).map(name => wb.Sheets[name].A5.v)).toEqual(names.map((_, i) => `item-${i}`));
  });

  it("keeps formula-looking service names as literal strings", () => {
    const wb = save([{ name: "ქსელი", rows: [['=HYPERLINK("https://example.invalid")', 12]] }]);
    expect(wb.Sheets["ქსელი"].A5.t).toBe("s");
    expect(wb.Sheets["ქსელი"].A5.f).toBeUndefined();
  });

  it("produces a valid, explicit zero-result workbook", () => {
    const wb = save([]);
    expect(wb.SheetNames).toEqual(["სარჩევი"]);
    expect(wb.Sheets["სარჩევი"].B5.v).toBe(0);
    expect(wb.Sheets["სარჩევი"].A6.v).toBe("ჩანაწერები არ მოიძებნა");
  });
});

describe("subgroup catalogue grouping", () => {
  const rows = [
    { id: 1, name: "Z", description: null, systemType: "network", subgroupId: 2, subgroupName: "HDMI კაბელები" },
    { id: 2, name: "A", description: null, systemType: "network", subgroupId: null, subgroupName: null },
    { id: 3, name: "A", description: null, systemType: "network", subgroupId: 2, subgroupName: "HDMI კაბელები" },
    { id: 4, name: "B", description: null, systemType: "network", subgroupId: 3, subgroupName: "HDMI კაბელები" },
  ];
  it("searches subgroup names case-insensitively with partial matches", () => {
    expect(filterServiceCatalogue(rows, labels, { q: " hdmi " }).map(r => r.id)).toEqual([1, 3, 4]);
    expect(filterServiceCatalogue(rows, labels, { q: "hdmi", cat: "camera" })).toEqual([]);
  });
  it("groups by id, sorts names, keeps ungrouped items last without mutation", () => {
    const groups = groupByServiceSubgroup(rows);
    expect(groups.map(g => g.key)).toEqual(["2", "3", NO_SUBGROUP]);
    expect(groups[0].items.map(r => r.id)).toEqual([3, 1]);
    expect(groups.at(-1)?.name).toBe("ქვეჯგუფის გარეშე");
    expect(rows.map(r => r.id)).toEqual([1, 2, 3, 4]);
    expect(groupByServiceSubgroup([])).toEqual([]);
  });
});
