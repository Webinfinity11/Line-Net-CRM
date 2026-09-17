import type { OrderStatus } from "@/db/schema";

export const FINISHED_STATUSES: OrderStatus[] = ["done", "closed", "cancelled"];

export function todayIso(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function isOverdue(o: { dueDate: string | null; status: OrderStatus }) {
  return Boolean(o.dueDate && o.dueDate < todayIso() && !FINISHED_STATUSES.includes(o.status));
}

/** Adds months to a date and returns YYYY-MM-DD (Tbilisi) */
export function addMonthsIso(from: Date | string, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Date → value for <input type="datetime-local"> in the browser's local time */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type ContactSource = {
  client?: { name: string; contactName?: string | null; phone?: string | null } | null;
  site?: { contactName?: string | null; contactPhone?: string | null } | null;
};

/**
 * Who the technician should call for this order. A branch with its own manager and
 * number wins over the company-wide contact, which is why sites carry both.
 */
export function orderContact(o: ContactSource): { name: string; phone: string | null; onSite: boolean } {
  const sitePhone = o.site?.contactPhone?.trim() || null;
  const siteName = o.site?.contactName?.trim() || null;
  if (sitePhone || siteName) {
    return { name: siteName ?? o.client?.contactName ?? o.client?.name ?? "—", phone: sitePhone ?? o.client?.phone ?? null, onSite: true };
  }
  return { name: o.client?.contactName ?? o.client?.name ?? "—", phone: o.client?.phone ?? null, onSite: false };
}

/** Digits only, so `tel:` links work with numbers written with spaces. */
export function telHref(phone: string | null | undefined): string | null {
  const n = phone?.replace(/[^\d+]/g, "");
  return n ? `tel:${n}` : null;
}

export function minutesBetween(a: Date | string | null | undefined, b: Date | string | null | undefined): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}
