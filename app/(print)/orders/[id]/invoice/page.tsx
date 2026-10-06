import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { getCompanySettings } from "@/lib/settings";
import { vatBreakdown } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/i18n";
import { PrintButton } from "@/components/app/print-button";
export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
 await requireUser(["admin", "manager"]);
 const { id } = await params; const orderId = Number(id); if (!Number.isInteger(orderId) || orderId <= 0) notFound();
 const [o,c] = await Promise.all([getOrder(orderId), getCompanySettings()]); if (!o) notFound();
 const sums = vatBreakdown(o.items, o.vatPercent, o.amount); const amount = o.items.length ? sums.gross : Number(o.amount ?? 0);
 return <main className="mx-auto max-w-[794px] bg-white text-neutral-900 [overflow-wrap:anywhere] p-4 sm:p-8 text-[13px] print:p-0"><div className="print:hidden mb-4"><PrintButton/></div><header className="border-b pb-4"><Image src="/brand/logo.png" alt="ლაინნეტი" width={1372} height={1653} unoptimized loading="eager" className="mb-[8px] h-[48px] w-auto" /><h1 className="font-heading text-[24px]">ინვოისი № {o.number}</h1><p>თარიღი: {formatDate(o.closedAt ?? o.completedAt ?? o.createdAt)}</p></header><section className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 py-4"><div><h2 className="font-heading">შემსრულებელი</h2><p>{c.company_name || "—"}</p><p>ს/კ {c.company_id_code || "—"}</p><p>{c.company_address}</p><p>{c.company_phone} {c.company_email}</p></div><div><h2 className="font-heading">დამკვეთი</h2><p>{o.client?.name ?? "—"}</p><p>ს/კ {o.client?.idCode ?? "—"}</p><p>{o.site?.name}</p></div></section><table className="w-full table-fixed border-collapse text-[11px] sm:text-[13px] print:text-[13px]"><thead className="print:table-header-group"><tr className="border-b text-left"><th className="w-[40%] py-2">დასახელება</th><th>რაოდ.</th><th>ერთ.</th><th>ფასი</th><th>ჯამი</th></tr></thead><tbody>{o.items.map(i => <tr key={i.id} className="border-b print:break-inside-avoid"><td className="py-2 break-words">{i.name}</td><td>{Number(i.quantity)}</td><td>{i.unit}</td><td>{formatMoney(i.unitPrice)}</td><td>{formatMoney(Number(i.quantity)*Number(i.unitPrice))}</td></tr>)}</tbody></table><div className="py-4 text-right print:break-inside-avoid">{sums.rate > 0 && <><p>დღგ-ს გარეშე: {formatMoney(sums.net)}</p><p>დღგ {sums.rate}%: {formatMoney(sums.vat)}</p></>}<p className="font-bold">ჯამი: {formatMoney(amount)}</p></div><footer className="border-t pt-4 print:break-inside-avoid"><h2 className="font-heading">საბანკო რეკვიზიტები</h2><p>{c.company_bank || "—"}</p><p className="break-all">{c.company_iban || "—"}</p><p className="mt-3">დანიშნულება: {o.number}</p></footer></main>;
}
