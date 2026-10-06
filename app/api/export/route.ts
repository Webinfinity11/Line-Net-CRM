import * as XLSX from "xlsx";
import { materialsCost } from "@/lib/finance";
import { PAYMENT_LABELS, PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/i18n";
import { clientsForExport, defaultPeriod, ordersForExport, reportByClient, reportByExecutor, reportBySystem, reportMonthly, type Period } from "@/lib/reports";
import { getSession, isStaff } from "@/lib/session";
import { listSystems, systemLabels } from "@/lib/systems";
import { listServices } from "@/lib/services";
import { compareServiceSubgroups, filterServiceCatalogue, groupByServiceCategory } from "@/lib/service-groups";
import { groupedExcelWorkbook } from "@/lib/grouped-excel";

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d)).replace(",", "");
}

const SOURCE_LABELS: Record<string, string> = { manual: "ხელით", email: "ელფოსტა", schedule: "გრაფიკი", portal: "კაბინეტი" };

function period(url: URL): Period {
  const d = defaultPeriod();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return { from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : d.from, to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : d.to };
}

function xlsx(sheets: { name: string; rows: Record<string, unknown>[] }[], fileName: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    const widths = Object.keys(s.rows[0] ?? {}).map((k) => ({ wch: Math.min(60, Math.max(k.length + 2, ...s.rows.slice(0, 200).map((r) => String(r[k] ?? "").length + 2))) }));
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  return workbookResponse(wb, fileName);
}

function workbookResponse(wb: XLSX.WorkBook, fileName: string) {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "orders";
  const p = period(url);
  const suffix = `${p.from}_${p.to}`;
  const SYSTEM_LABELS = await systemLabels();

  switch (type) {
    case "services": {
      const [catalogue, categories] = await Promise.all([listServices({ includeInactive: true }), listSystems()]);
      const q = url.searchParams.get("q") ?? undefined;
      const cat = url.searchParams.get("cat") ?? undefined;
      const rows = filterServiceCatalogue(catalogue, SYSTEM_LABELS, { q, cat });
      const context = ["სერვისების ცნობარი", q?.trim() ? `ძებნა: ${q.trim()}` : "", cat ? `კატეგორია: ${SYSTEM_LABELS[cat] ?? "კატეგორიის გარეშე"}` : "ყველა კატეგორია"].filter(Boolean).join(" · ");
      return workbookResponse(groupedExcelWorkbook({
        title: "სერვისები კატეგორიების მიხედვით", context,
        columns: [
          { label: "კოდი", width: 12 }, { label: "დასახელება", width: 56 },
          { label: "კატეგორია", width: 32 }, { label: "ქვეჯგუფი", width: 32 }, { label: "საზომი ერთეული", width: 20 },
          { label: "ერთეულის ფასი (₾)", width: 23, format: '#,##0.00 "₾"' },
          { label: "სტატუსი", width: 16 }, { label: "აღწერა", width: 64 },
        ],
        groups: groupByServiceCategory(rows, categories).map(group => ({
          name: group.name,
          rows: [...group.items].sort(compareServiceSubgroups).map(item => [item.id, item.name, group.name, item.subgroupName ?? "ქვეჯგუფის გარეშე", item.unit, Number(item.price), item.active ? "აქტიური" : "არააქტიური", item.description ?? ""]),
        })),
      }), "services-by-category.xlsx");
    }
    case "orders": {
      const all = url.searchParams.get("all") === "1";
      const [rows, categories] = await Promise.all([ordersForExport(all ? null : p), listSystems()]);
      const orderRow = (o: (typeof rows)[number]) => ({
        ნომერი: o.number,
        სათაური: o.title,
        სტატუსი: STATUS_LABELS[o.status],
        ტიპი: TYPE_LABELS[o.type],
        კატეგორია: o.systemType ? SYSTEM_LABELS[o.systemType] : "",
        პრიორიტეტი: PRIORITY_LABELS[o.priority],
        კლიენტი: o.client?.name ?? "",
        ობიექტი: o.site?.name ?? "",
        მისამართი: o.address ?? o.site?.address ?? "",
        შემსრულებლები: o.assignees.map((a) => a.user.name).join(", "),
        შეიქმნა: fmtDate(o.createdAt),
        დაგეგმილი: fmtDate(o.scheduledAt),
        ვადა: o.dueDate ?? "",
        მისვლა: fmtDate(o.arrivedAt),
        დასრულება: fmtDate(o.finishedAt),
        შესრულდა: fmtDate(o.completedAt),
        თანხა: o.amount ? Number(o.amount) : "",
        მიღებული: Number(o.paidTotal) || 0,
        ნაშთი: o.amount ? Math.max(0, Number(o.amount) - Number(o.paidTotal)) : "",
        გადახდა: PAYMENT_LABELS[o.paymentStatus] + (o.paymentReviewNeeded ? " (დასაზუსტებელი)" : ""),
        "მასალების ხარჯი": (() => {
          const c = materialsCost(o.materials);
          return c.known ? c.cost : "უცნობია";
        })(),
        "ვიზიტების საათები": Math.round((o.visits.reduce((sum, v) => sum + (v.endedAt ? (v.endedAt.getTime() - v.startedAt.getTime()) / 60000 : 0), 0) / 60) * 10) / 10 || "",
        გარანტია: o.warrantyUntil ?? "",
        წყარო: SOURCE_LABELS[o.source] ?? o.source,
      });
      // Preserve every existing export column, with a separate sheet per category.
      const groups = groupByServiceCategory(rows, categories);
      const columnNames = rows.length ? Object.keys(orderRow(rows[0])) : [];
      return workbookResponse(groupedExcelWorkbook({
        title: "შეკვეთები კატეგორიების მიხედვით",
        context: all ? "ყველა თარიღი" : `პერიოდი: ${p.from} – ${p.to}`,
        columns: columnNames.map(label => ({ label, width: label === "სათაური" || label === "მისამართი" ? 54 : 25 })),
        groups: groups.map(group => ({ name: group.name, rows: group.items.map(o => Object.values({ ...orderRow(o), კატეგორია: group.name })) })),
      }), all ? "orders-all.xlsx" : `orders-${suffix}.xlsx`);
    }
    case "clients": {
      const rows = await reportByClient(p);
      return xlsx([{ name: "კლიენტები", rows: rows.map((r) => ({ კლიენტი: r.client, შეკვეთები: r.total, შესრულებული: r.completed, თანხა: r.amount, გადახდილი: r.paid, გადაუხდელი: r.unpaid })) }], `report-clients-${suffix}.xlsx`);
    }
    case "executors": {
      const rows = await reportByExecutor(p);
      return xlsx(
        [{ name: "შემსრულებლები", rows: rows.map((r) => ({ შემსრულებელი: r.name, შეკვეთები: r.total, შესრულებული: r.completed, ვადაგადაცილებული: r.overdue, დაგვიანებით: r.lateDone, საათები: r.hours, თანხა: r.amount })) }],
        `report-executors-${suffix}.xlsx`,
      );
    }
    case "systems": {
      const rows = await reportBySystem(p);
      return xlsx([{ name: "კატეგორიები", rows: rows.map((r) => ({ კატეგორია: r.system ? SYSTEM_LABELS[r.system] : "—", შეკვეთები: r.total, შესრულებული: r.completed, თანხა: r.amount, გადახდილი: r.paid })) }], `report-systems-${suffix}.xlsx`);
    }
    case "monthly": {
      const r = await reportMonthly(12);
      return xlsx(
        [{ name: "თვეები", rows: r.months.map((m) => ({ თვე: m.month, შექმნილი: m.created, შესრულებული: m.completed, დაჯავშნილი: m.booked, შემოსული: m.revenue, "მასალების ხარჯი": m.cost, "სხვაობა მასალების შემდეგ": m.profit })) }],
        "report-monthly.xlsx",
      );
    }
    case "clients-list": {
      const rows = await clientsForExport();
      const flat = rows.flatMap((c) =>
        (c.sites.length ? c.sites : [null]).map((site) => ({
          კომპანია: c.name,
          "ს/კ": c.idCode ?? "",
          კონტაქტი: c.contactName ?? "",
          ტელეფონი: c.phone ?? "",
          ელფოსტა: c.email ?? "",
          ობიექტი: site?.name ?? "",
          მისამართი: site?.address ?? "",
        })),
      );
      return xlsx([{ name: "კლიენტები", rows: flat }], "clients.xlsx");
    }
    case "clients-template":
      return xlsx(
        [{ name: "კლიენტები", rows: [{ კომპანია: "შპს მაგალითი", "ს/კ": "404000000", კონტაქტი: "გიორგი", ტელეფონი: "599 00 00 00", ელფოსტა: "info@example.ge", ობიექტი: "ფილიალი ვაკე", მისამართი: "ჭავჭავაძის 1" }] }],
        "clients-template.xlsx",
      );
    default:
      return new Response("Unknown export", { status: 400 });
  }
}
