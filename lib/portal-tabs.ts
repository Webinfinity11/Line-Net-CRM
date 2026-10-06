import type { OrderStatus } from "@/db/schema";

export const PORTAL_TABS = [
  { key: "all", label: "ყველა" },
  { key: "sent", label: "გაგზავნილი" },
  { key: "planned", label: "მიღებული/დაგეგმილი" },
  { key: "progress", label: "პროცესში" },
  { key: "done", label: "შესრულებული" },
  { key: "cancelled", label: "გაუქმებული" },
] as const;

export type PortalTab = (typeof PORTAL_TABS)[number]["key"];

export function portalTabOf(status: OrderStatus, triaged: boolean): Exclude<PortalTab, "all"> {
  if (!triaged) return "sent";
  switch (status) {
    case "new":
    case "assigned": return "planned";
    case "in_progress": return "progress";
    case "done":
    case "closed": return "done";
    case "cancelled": return "cancelled";
  }
}

export function countPortalTabs(rows: { status: OrderStatus; triaged: boolean }[]): Record<PortalTab, number> {
  const counts = { all: rows.length, sent: 0, planned: 0, progress: 0, done: 0, cancelled: 0 };
  for (const row of rows) counts[portalTabOf(row.status, row.triaged)]++;
  return counts;
}

export function parsePortalTab(value: string | undefined): PortalTab {
  return PORTAL_TABS.find((tab) => tab.key === value)?.key ?? "all";
}
