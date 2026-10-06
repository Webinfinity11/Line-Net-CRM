/** Calendar-only values never pass through the browser's timezone or locale. */
export const MONTHS_KA = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
export const WEEKDAYS_KA = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];
const pad = (n: number) => String(n).padStart(2, "0");
export function dateKey(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === "0000") return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && dateKey(date) === value ? date : null;
}
export function formatFieldDate(value: string): string {
  return parseDate(value) ? value.split("-").reverse().join(".") : "";
}
export function monthGrid(month: string): string[] {
  const first = parseDate(`${month.slice(0, 7)}-01`);
  if (!first) return [];
  first.setUTCDate(1 - (first.getUTCDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => dateKey(new Date(+first + index * 86_400_000)));
}
export function shiftMonth(month: string, offset: number): string {
  const date = parseDate(`${month.slice(0, 7)}-01`);
  if (!date) return "";
  date.setUTCMonth(date.getUTCMonth() + offset);
  return dateKey(date);
}
export function dateAllowed(value: string, min?: string, max?: string): boolean {
  return !!parseDate(value) && (!min || value >= min) && (!max || value <= max);
}
export function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export const TIME_OPTIONS = Array.from({ length: 57 }, (_, index) => {
  const minutes = 7 * 60 + index * 15;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});
export function joinDateTime(date: string, time: string): string {
  return parseDate(date) && validTime(time) ? `${date}T${time}` : "";
}
export function tbilisiDate(now = new Date()): string {
  return dateKey(new Date(+now + 4 * 3_600_000));
}
