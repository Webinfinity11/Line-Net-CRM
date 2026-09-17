import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import { QUOTE_STATUS_LABELS, quoteTotals } from "@/components/app/quotes/status";
import { formatDate, formatMoney } from "@/lib/i18n";
import { getQuote } from "@/lib/quotes";
import { requireUser } from "@/lib/session";
import { systemLabels } from "@/lib/systems";

export const metadata = { title: "კომერციული შეთავაზება" };

export default async function QuotePdfPage({ params }: PageProps<"/quotes/[id]/pdf">) {
  await requireUser(["admin", "manager"]);
  const { id } = await params;
  const quote = await getQuote(Number(id));
  if (!quote) notFound();
  const labels = await systemLabels();
  const { subtotal, vatRate, vat, total } = quoteTotals(quote.items, quote.vatPercent);

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-8 text-neutral-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-neutral-500">ბეჭდვისას აირჩიეთ „Save as PDF“</span>
        <PrintButton />
      </div>

      <header className="mb-5 flex items-start justify-between border-b-2 border-neutral-900 pb-3">
        <div>
          <div className="text-xl font-bold">Line Net</div>
          <div className="text-xs text-neutral-600">შპს ლაინნეტი · ს/კ 404486757 · თბილისი, ბახტრიონის 30 · 0322 022 022 · info@line-net.ge</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">კომერციული შეთავაზება</div>
          <div className="font-mono text-sm">{quote.number}</div>
          <div className="text-xs text-neutral-600">{formatDate(quote.createdAt)}</div>
        </div>
      </header>

      <h1 className="mb-3 text-base font-semibold">{quote.title}</h1>

      <table className="mb-5 w-full border-collapse">
        <tbody>
          <tr>
            <td className="w-40 border px-2 py-1 text-xs text-neutral-500">კლიენტი</td>
            <td className="border px-2 py-1 text-sm">
              {quote.client
                ? [quote.client.name, quote.client.idCode ? `ს/კ ${quote.client.idCode}` : null, quote.client.contactName, quote.client.phone].filter(Boolean).join(" · ")
                : "—"}
            </td>
          </tr>
          <tr>
            <td className="w-40 border px-2 py-1 text-xs text-neutral-500">ობიექტი</td>
            <td className="border px-2 py-1 text-sm">
              {[...new Set([quote.site?.name, quote.site?.address, quote.site?.contactName, quote.site?.contactPhone].filter(Boolean))].join(" · ") || "—"}
            </td>
          </tr>
          <tr>
            <td className="w-40 border px-2 py-1 text-xs text-neutral-500">სისტემა</td>
            <td className="border px-2 py-1 text-sm">{quote.systemType ? (labels[quote.systemType] ?? quote.systemType) : "—"}</td>
          </tr>
          <tr>
            <td className="w-40 border px-2 py-1 text-xs text-neutral-500">ძალაშია თარიღამდე</td>
            <td className="border px-2 py-1 text-sm">{quote.validUntil ? formatDate(quote.validUntil) : "—"}</td>
          </tr>
          <tr>
            <td className="w-40 border px-2 py-1 text-xs text-neutral-500">სტატუსი</td>
            <td className="border px-2 py-1 text-sm">{QUOTE_STATUS_LABELS[quote.status]}</td>
          </tr>
        </tbody>
      </table>

      <section className="mb-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-100 text-left text-xs">
              <th className="border px-2 py-1 w-8">#</th>
              <th className="border px-2 py-1">დასახელება</th>
              <th className="border px-2 py-1 text-right">რაოდ.</th>
              <th className="border px-2 py-1">ერთეული</th>
              <th className="border px-2 py-1 text-right">ერთ. ფასი</th>
              <th className="border px-2 py-1 text-right">ჯამი</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((i, index) => (
              <tr key={i.id}>
                <td className="border px-2 py-1">{index + 1}</td>
                <td className="border px-2 py-1">{i.name}</td>
                <td className="border px-2 py-1 text-right">{Number(i.quantity)}</td>
                <td className="border px-2 py-1">{i.unit}</td>
                <td className="border px-2 py-1 text-right">{formatMoney(i.unitPrice)}</td>
                <td className="border px-2 py-1 text-right">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</td>
              </tr>
            ))}
            {quote.items.length === 0 && (
              <tr>
                <td className="border px-2 py-3 text-center text-neutral-500" colSpan={6}>
                  პოზიციები არ არის
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-1 text-right text-xs text-neutral-500" colSpan={5}>
                ჯამი დღგ-ს გარეშე
              </td>
              <td className="border px-2 py-1 text-right text-sm">{formatMoney(subtotal)}</td>
            </tr>
            {vatRate > 0 && (
              <tr>
                <td className="px-2 py-1 text-right text-xs text-neutral-500" colSpan={5}>
                  დღგ {vatRate}%
                </td>
                <td className="border px-2 py-1 text-right text-sm">{formatMoney(vat)}</td>
              </tr>
            )}
            <tr>
              <td className="px-2 py-1 text-right text-xs font-semibold" colSpan={5}>
                სულ გადასახდელი
              </td>
              <td className="border bg-neutral-100 px-2 py-1 text-right text-sm font-bold">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {quote.note && (
        <section className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">შენიშვნა</div>
          <pre className="whitespace-pre-wrap rounded border p-2 font-sans text-sm">{quote.note}</pre>
        </section>
      )}

      {quote.terms && (
        <section className="mb-6">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">პირობები</div>
          <pre className="whitespace-pre-wrap rounded border p-2 font-sans text-sm">{quote.terms}</pre>
        </section>
      )}

      <section className="grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="mb-8 text-xs text-neutral-500">შემსრულებელი (სახელი, ხელმოწერა)</div>
          <div className="border-t border-neutral-700" />
        </div>
        <div>
          <div className="mb-8 text-xs text-neutral-500">დამკვეთი (სახელი, ხელმოწერა, თარიღი)</div>
          <div className="border-t border-neutral-700" />
        </div>
      </section>

      <footer className="mt-8 text-center text-[10px] text-neutral-400">
        Line Net CRM · {quote.number} · დაბეჭდილია {formatDate(new Date(), true)}
      </footer>
    </main>
  );
}
