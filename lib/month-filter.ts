export const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const OFFSET = 4 * 60 * 60_000;

/** Half-open year or month boundaries at midnight in Tbilisi. Invalid URL values are ignored. */
export function parseMonth(value: string | undefined): { from: Date; to: Date } | null {
  if (!value || !/^[1-9]\d{3}(-(0[1-9]|1[0-2]))?$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, month ? month - 1 : 0, 1) - OFFSET),
    to: new Date(Date.UTC(month ? year : year + 1, month || 0, 1) - OFFSET),
  };
}

/** Every Tbilisi calendar month, newest first, with deterministic Georgian labels. */
export function monthOptions(oldest: Date, now: Date): { value: string; label: string }[] {
  if (!Number.isFinite(oldest.getTime()) || !Number.isFinite(now.getTime())) return [];
  const first = new Date(oldest.getTime() + OFFSET);
  const last = new Date(now.getTime() + OFFSET);
  const start = first.getUTCFullYear() * 12 + first.getUTCMonth();
  const end = last.getUTCFullYear() * 12 + last.getUTCMonth();
  const options = [];
  for (let index = end; index >= start; index--) {
    const year = Math.floor(index / 12);
    const month = index % 12;
    options.push({ value: `${year}-${String(month + 1).padStart(2, "0")}`, label: `${MONTHS[month]} ${year}` });
  }
  return options;
}
