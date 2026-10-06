import * as XLSX from "xlsx";

type Cell = string | number | boolean | null;
export type ExportColumn = { label: string; width: number; format?: string };
export type ExportGroup = { name: string; rows: Cell[][] };

function uniqueSheetName(label: string, used: Set<string>) {
  const clean = label.replace(/[\\/?*\[\]:\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/^'+|'+$/g, "").trim() || "კატეგორია";
  for (let index = 1; ; index++) {
    const suffix = index === 1 ? "" : ` (${index})`;
    const base = clean.slice(0, 31 - suffix.length).replace(/[\uD800-\uDBFF]$/, "").replace(/'+$/, "");
    const name = `${base}${suffix}`;
    if (!used.has(name.toLowerCase()) && name.toLowerCase() !== "history") {
      used.add(name.toLowerCase());
      return name;
    }
  }
}

/** A directory followed by separate, filterable category sheets. No duplicated flat list. */
export function groupedExcelWorkbook({ title, context, columns, groups }: {
  title: string; context: string; columns: ExportColumn[]; groups: ExportGroup[];
}) {
  const workbook = XLSX.utils.book_new();
  const used = new Set(["სარჩევი"]);
  const names = groups.map(group => uniqueSheetName(group.name, used));
  const summaryRows: Cell[][] = [
    [title], [context], [], ["კატეგორია", "რაოდენობა", "ფურცელი"],
    ...groups.map((group, i) => [group.name, group.rows.length, names[i]]),
    ["სულ", groups.reduce((n, group) => n + group.rows.length, 0)],
  ];
  if (!groups.length) summaryRows.push(["ჩანაწერები არ მოიძებნა"]);
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 52 }, { wch: 16 }, { wch: 34 }];
  summary["!merges"] = [0, 1].map(r => ({ s: { r, c: 0 }, e: { r, c: 2 } }));
  summary["!rows"] = [{ hpt: 26 }, { hpt: 24 }, { hpt: 10 }, { hpt: 24 }];
  for (let i = 0; i < groups.length; i++) {
    const quoted = names[i].replace(/'/g, "''");
    summary[`C${i + 5}`].l = { Target: `#'${quoted}'!A1`, Tooltip: "კატეგორიის გახსნა" };
  }
  XLSX.utils.book_append_sheet(workbook, summary, "სარჩევი");

  groups.forEach((group, index) => {
    const sheet = XLSX.utils.aoa_to_sheet([
      [group.name], [context], [], columns.map(column => column.label), ...group.rows,
    ]);
    sheet["!cols"] = columns.map(column => ({ wch: column.width }));
    sheet["!rows"] = [{ hpt: 26 }, { hpt: 24 }, { hpt: 10 }, { hpt: 24 }];
    sheet["!merges"] = [0, 1].map(r => ({ s: { r, c: 0 }, e: { r, c: columns.length - 1 } }));
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + group.rows.length, c: columns.length - 1 } }) };
    group.rows.forEach((row, r) => row.forEach((_, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: r + 4, c })];
      if (cell?.t === "n" && columns[c].format) cell.z = columns[c].format;
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, names[index]);
  });
  return workbook;
}
