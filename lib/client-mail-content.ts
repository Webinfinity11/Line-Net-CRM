import { formatDate, formatMoney } from "./i18n";
import { vatBreakdown } from "./finance";
export type ClientMailKind = "received" | "scheduled" | "completed";
export const CLIENT_MAIL_LABELS: Record<ClientMailKind, string> = { received: "მიღებულია", scheduled: "ვიზიტი დაიგეგმა", completed: "დასრულდა" };
type RecipientOrder = { source: string; emailFrom: string | null; client?: { email: string | null } | null; site?: { contacts: { email: string | null; receivesEmail: boolean }[] } | null };
export function clientMailRecipients(o: RecipientOrder) {
 const address = (raw: string | null | undefined, allowName = false) => {
  if (!raw || /[\r\n]/.test(raw)) return null;
  const value = raw.trim();
  const candidate = allowName ? value.match(/^[^<>]*<([^<>]+)>$/)?.[1]?.trim() ?? value : value;
  return /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(candidate) ? candidate : null;
 };
 if (o.source === "email") { const sender = address(o.emailFrom, true); return sender ? [sender] : []; }
 const contacts = o.site?.contacts.filter(c => c.receivesEmail).map(c => address(c.email)).filter((s): s is string => Boolean(s)) ?? [];
 const fallback = address(o.client?.email);
 const recipients = contacts.length ? contacts : fallback ? [fallback] : [];
 return recipients.filter((s, index) => recipients.findIndex(other => other.toLowerCase() === s.toLowerCase()) === index);
}
export function escapeMailHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }
export function renderClientMail(kind: ClientMailKind, o: { number: string; title: string; scheduledAt: Date | null; completionNote: string | null; amount: string | null; vatPercent: string; items: { name: string; quantity: string; unit: string; unitPrice: string }[] }, company: Record<string, string>) {
 const subject = `${o.number} · ${CLIENT_MAIL_LABELS[kind]}`;
 const h = escapeMailHtml;
 const sums = vatBreakdown(o.items, o.vatPercent, o.amount);
 const total = o.items.length ? sums.gross : Number(o.amount ?? 0);
 const lines = [subject, o.title, kind === "scheduled" ? `ვიზიტი: ${formatDate(o.scheduledAt, true)}` : kind === "completed" ? o.completionNote ?? "სამუშაო დასრულდა" : "თქვენი მოთხოვნა მიღებულია."];
 let invoice = "";
 if (kind === "completed") {
  const rows = o.items.map(i => [i.name, `${Number(i.quantity)} ${i.unit}`, formatMoney(i.unitPrice), formatMoney(Number(i.quantity)*Number(i.unitPrice))]);
  rows.forEach(r => lines.push(r.join(" · ")));
  if (sums.rate > 0) lines.push(`დღგ-ს გარეშე: ${formatMoney(sums.net)}`, `დღგ ${sums.rate}%: ${formatMoney(sums.vat)}`);
  lines.push(`ჯამი: ${formatMoney(total)}`);
  invoice = `<h2>ინვოისი ${h(o.number)}</h2><table style="width:100%;border-collapse:collapse"><thead><tr>${["დასახელება","რაოდენობა","ფასი","ჯამი"].map(x => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:8px;border-bottom:1px solid #ddd">${h(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>${sums.rate > 0 ? `<p>დღგ-ს გარეშე: ${h(formatMoney(sums.net))}<br>დღგ ${sums.rate}%: ${h(formatMoney(sums.vat))}</p>` : ""}<p><strong>ჯამი: ${h(formatMoney(total))}</strong></p>`;
 }
 const details = Object.values(company).filter(Boolean).join(" · "); lines.push(details);
 return { subject, text: lines.join("\n\n"), html: `<div lang="ka" style="font-family:Arial,sans-serif;color:#17212b;max-width:720px"><h1>${h(subject)}</h1><p>${h(o.title)}</p><p style="white-space:pre-wrap">${h(lines[2])}</p>${invoice}<hr><p>${h(details)}</p></div>` };
}
