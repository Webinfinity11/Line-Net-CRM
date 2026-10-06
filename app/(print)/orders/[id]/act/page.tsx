import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import { vatBreakdown } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/i18n";
import { orderContact } from "@/lib/order-utils";
import { getOrder } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { getCompanySettings } from "@/lib/settings";
import { systemLabels } from "@/lib/systems";

export const metadata = { title: "მიღება-ჩაბარების აქტი" };

/**
 * The document a Georgian B2B client signs before paying: who did what, at which object,
 * with quantities and prices from the order's billable lines.
 */
export default async function ActPage({ params }: PageProps<"/orders/[id]/act">) {
  await requireUser(["admin", "manager"]);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const [order, labels, company] = await Promise.all([getOrder(orderId), systemLabels(), getCompanySettings()]);
  if (!order) notFound();
  // The act used to carry these by hand; they stay as the fallback until an admin fills /settings/company.
  const seller = {
    name: company.company_name || "შპს ლაინნეტი",
    idCode: company.company_id_code || "404486757",
    address: company.company_address || "თბილისი, ბახტრიონის ქ. 30, ბ1",
    phone: company.company_phone || "0322 022 022",
    email: company.company_email || "info@line-net.ge",
  };

  const lines = order.items ?? [];
  const sums = vatBreakdown(lines, order.vatPercent, order.amount);
  const amount = lines.length > 0 ? sums.gross : Number(order.amount ?? 0);
  const done = order.completedAt ?? order.updatedAt;
  const contact = orderContact(order);

  return (
    <main className="mx-auto max-w-[794px] bg-white p-4 sm:p-8 [overflow-wrap:anywhere] text-neutral-900 print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <span className="text-sm text-neutral-500">ბეჭდვის ფანჯარაში აირჩიეთ PDF-ად შენახვა</span>
        <PrintButton />
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b-2 border-neutral-900 pb-3">
        <div>
          <div className="text-xl font-bold">Line Net</div>
          <div className="text-[11px] text-neutral-600">{[seller.name, `ს/კ ${seller.idCode}`, seller.address, seller.phone, seller.email].join(" · ")}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">მიღება-ჩაბარების აქტი</div>
          <div className="font-mono text-sm">№ {order.number}</div>
          <div className="text-[11px] text-neutral-600">{formatDate(done)}</div>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 text-[12px]">
        <div className="border border-neutral-300 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">შემსრულებელი</div>
          <div className="font-semibold">{seller.name}</div>
          <div>ს/კ {seller.idCode}</div>
          <div>{seller.address}</div>
          <div>{seller.phone} · {seller.email}</div>
        </div>
        <div className="border border-neutral-300 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">დამკვეთი</div>
          <div className="font-semibold">{order.client?.name ?? "—"}</div>
          {order.client?.idCode && <div>ს/კ {order.client.idCode}</div>}
          {order.site?.address && <div>{order.site.address}</div>}
          <div>{[contact.name !== "—" ? contact.name : null, contact.phone].filter(Boolean).join(" · ") || "—"}</div>
        </div>
      </section>

      <section className="mb-4 text-[12px]">
        <table className="w-full">
          <tbody>
            <tr>
              <td className="w-40 border border-neutral-300 px-2 py-1 text-neutral-500">ობიექტი</td>
              <td className="border border-neutral-300 px-2 py-1">{order.site?.name ?? order.address ?? "—"}</td>
            </tr>
            <tr>
              <td className="border border-neutral-300 px-2 py-1 text-neutral-500">კატეგორია</td>
              <td className="border border-neutral-300 px-2 py-1">{order.systemType ? (labels[order.systemType] ?? order.systemType) : "—"}</td>
            </tr>
            <tr>
              <td className="border border-neutral-300 px-2 py-1 text-neutral-500">სამუშაოს დასახელება</td>
              <td className="border border-neutral-300 px-2 py-1">{order.title}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <div className="mb-1.5 text-[12px] font-semibold">შესრულებული სამუშაო</div>
        {lines.length === 0 ? (
          <p className="border border-neutral-300 px-2 py-3 text-[12px] text-neutral-600">
            პოზიციები არ არის ჩაწერილი. ჯამური ღირებულება: {formatMoney(amount)}
          </p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="w-8 border border-neutral-300 px-2 py-1 text-left">№</th>
                <th className="border border-neutral-300 px-2 py-1 text-left">დასახელება</th>
                <th className="w-16 border border-neutral-300 px-2 py-1 text-right">ერთ.</th>
                <th className="w-16 border border-neutral-300 px-2 py-1 text-right">რაოდ.</th>
                <th className="w-24 border border-neutral-300 px-2 py-1 text-right">ფასი</th>
                <th className="w-28 border border-neutral-300 px-2 py-1 text-right">ჯამი</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((i, n) => (
                <tr key={i.id}>
                  <td className="border border-neutral-300 px-2 py-1">{n + 1}</td>
                  <td className="border border-neutral-300 px-2 py-1">{i.name}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right">{i.unit}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right">{Number(i.quantity)}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right">{formatMoney(i.unitPrice)}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</td>
                </tr>
              ))}
              {sums.rate > 0 && (
                <>
                  <tr>
                    <td colSpan={5} className="border border-neutral-300 px-2 py-1 text-right">
                      ჯამი დღგ-ს გარეშე
                    </td>
                    <td className="border border-neutral-300 px-2 py-1 text-right">{formatMoney(sums.net)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="border border-neutral-300 px-2 py-1 text-right">
                      დღგ {sums.rate}%
                    </td>
                    <td className="border border-neutral-300 px-2 py-1 text-right">{formatMoney(sums.vat)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={5} className="border border-neutral-300 px-2 py-1 text-right font-semibold">
                  სულ გადასახდელი
                </td>
                <td className="border border-neutral-300 px-2 py-1 text-right font-semibold">{formatMoney(amount)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {order.completionNote && (
        <section className="mb-4 text-[12px]">
          <div className="mb-1 font-semibold">შენიშვნა</div>
          <p className="whitespace-pre-wrap border border-neutral-300 px-2 py-2 leading-relaxed">{order.completionNote}</p>
        </section>
      )}

      <p className="mb-6 text-[12px] leading-relaxed">
        სამუშაო შესრულებულია სრულად და ხარისხიანად. დამკვეთს პრეტენზია არ აქვს. აქტი შედგენილია ორ ეგზემპლარად, თითოეული
        მხარისთვის, ორივეს თანაბარი იურიდიული ძალა აქვს.
      </p>

      <section className="grid grid-cols-2 gap-8 text-[12px]">
        {["შემსრულებელი", "დამკვეთი"].map((side) => (
          <div key={side}>
            <div className="mb-8 font-semibold">{side}</div>
            <div className="border-b border-neutral-400" />
            <div className="mt-1 text-[10px] text-neutral-500">სახელი, გვარი, ხელმოწერა, ბეჭედი</div>
            <div className="mt-4 border-b border-neutral-400" />
            <div className="mt-1 text-[10px] text-neutral-500">თარიღი</div>
          </div>
        ))}
      </section>
    </main>
  );
}
