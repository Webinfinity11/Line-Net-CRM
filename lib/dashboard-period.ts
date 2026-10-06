import { tbilisiDayBounds, tbilisiToday } from "@/lib/schedule-utils";

const DAY = 86_400_000;
export type HeroRange = "today" | "week" | "month";
export function validDashboardDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Half-open Tbilisi windows; month means calendar month to the current instant. */
export function dashboardPeriod(range: HeroRange, custom?: { from: string; to: string }, now = new Date()) {
  const today = tbilisiToday(now);
  const midnight = tbilisiDayBounds(today).start;
  let start = range === "month" ? tbilisiDayBounds(`${today.slice(0, 7)}-01`).start : new Date(+midnight - (range === "week" ? 6 : 0) * DAY);
  let end = now;
  let previousStart: Date;
  let previousEnd: Date;
  if (custom) {
    start = tbilisiDayBounds(custom.from).start;
    end = tbilisiDayBounds(custom.to).end;
    previousStart = new Date(+start - (+end - +start));
    previousEnd = start;
  } else if (range === "month") {
    const local = new Date(+now + 4 * 3_600_000);
    const y = local.getUTCFullYear(), m = local.getUTCMonth();
    previousStart = new Date(Date.UTC(y, m - 1, 1) - 4 * 3_600_000);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    previousEnd = local.getUTCDate() > lastDay ? start : new Date(Date.UTC(y, m - 1, local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds()) - 4 * 3_600_000);
  } else {
    const shift = (range === "today" ? 1 : 7) * DAY;
    previousStart = new Date(+start - shift);
    previousEnd = new Date(+end - shift);
  }
  const step = !custom && range === "today" ? 3_600_000 : +end - +start > 45 * DAY ? 7 * DAY : DAY;
  return { start, end, previousStart, previousEnd, step };
}
export type DashboardPeriod = ReturnType<typeof dashboardPeriod>;
export function dashboardBuckets(period: DashboardPeriod) {
  const result: { start: Date; end: Date; label: string }[] = [];
  for (let t = +period.start; t < +period.end; t += period.step) {
    const local = new Date(t + 4 * 3_600_000);
    result.push({ start: new Date(t), end: new Date(Math.min(t + period.step, +period.end)), label: period.step < DAY ? `${String(local.getUTCHours()).padStart(2, "0")}:00` : `${String(local.getUTCDate()).padStart(2, "0")}.${String(local.getUTCMonth() + 1).padStart(2, "0")}` });
  }
  return result;
}
