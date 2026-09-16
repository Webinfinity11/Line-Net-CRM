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

export function minutesBetween(a: Date | string | null | undefined, b: Date | string | null | undefined): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? Math.round(ms / 60000) : null;
}
