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
