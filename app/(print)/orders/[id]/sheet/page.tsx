import { notFound } from "next/navigation";
import { PrintButton } from "@/components/app/print-button";
import { PAYMENT_LABELS, PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS, formatDate, formatMoney } from "@/lib/i18n";
import { getOrder } from "@/lib/orders";
import { isStaff, requireUser } from "@/lib/session";
import { systemLabels } from "@/lib/systems";

export const metadata = { title: "სამუშაო ფურცელი" };

export default async function WorkSheetPage({ params }: PageProps<"/orders/[id]/sheet">) {
  const me = await requireUser();
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) notFound();
  const staff = isStaff(me.role);
  if (!staff && !order.assignees.some((a) => a.userId === me.id)) notFound();
  const SYSTEM_LABELS = await systemLabels();

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <tr>
      <td className="w-40 border px-2 py-1 text-xs text-neutral-500">{label}</td>
      <td className="border px-2 py-1 text-sm">{value ?? "—"}</td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-8 text-neutral-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-muted-foreground">ბეჭდვის ფანჯარაში აირჩიეთ PDF-ად შენახვა</span>
        <PrintButton />
      </div>

      <header className="mb-5 flex items-start justify-between border-b-2 border-neutral-900 pb-3">
        <div>
          <div className="text-xl font-bold">Line Net</div>
          <div className="text-xs text-neutral-600">შპს ლაინნეტი · ს/კ 404486757 · თბილისი, ბახტრიონის 30 · 0322 022 022 · info@line-net.ge</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">სამუშაო ფურცელი</div>
          <div className="font-mono text-sm">{order.number}</div>
          <div className="text-xs text-neutral-600">{formatDate(order.createdAt)}</div>
        </div>
      </header>

      <h1 className="mb-3 text-base font-semibold">{order.title}</h1>

      <table className="mb-4 w-full border-collapse">
        <tbody>
          <Row label="კლიენტი" value={order.client ? `${order.client.name}${order.client.contactName ? " · " + order.client.contactName : ""}${order.client.phone ? " · " + order.client.phone : ""}` : null} />
          <Row label="ობიექტი" value={[order.site?.name, order.address ?? order.site?.address].filter(Boolean).join(" · ") || null} />
          <Row label="კატეგორია / ტიპი" value={`${order.systemType ? SYSTEM_LABELS[order.systemType] + " · " : ""}${TYPE_LABELS[order.type]} · ${PRIORITY_LABELS[order.priority]}`} />
          <Row label="დაგეგმილი დრო" value={order.scheduledAt ? formatDate(order.scheduledAt, true) : formatDate(order.dueDate)} />
          <Row label="შემსრულებლები" value={order.assignees.map((a) => a.user.name + (a.user.phone ? ` (${a.user.phone})` : "")).join(", ") || null} />
          <Row label="სტატუსი" value={STATUS_LABELS[order.status]} />
          {(order.arrivedAt || order.finishedAt) && (
            <Row label="ობიექტზე ყოფნის დრო" value={`${order.arrivedAt ? formatDate(order.arrivedAt, true) : "—"} → ${order.finishedAt ? formatDate(order.finishedAt, true) : "—"}`} />
          )}
          {staff && order.amount ? <Row label="თანხა" value={`${formatMoney(order.amount)} · ${PAYMENT_LABELS[order.paymentStatus]}`} /> : null}
        </tbody>
      </table>

      {order.description && (
        <section className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">სამუშაოს აღწერა</div>
          <pre className="whitespace-pre-wrap rounded border p-2 font-sans text-sm">{order.description}</pre>
        </section>
      )}

      <section className="mb-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">გამოყენებული მასალები</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-100 text-left text-xs">
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">დასახელება</th>
              <th className="border px-2 py-1 text-right">რაოდენობა</th>
              {staff && <th className="border px-2 py-1 text-right">ფასი</th>}
            </tr>
          </thead>
          <tbody>
            {order.materials.map((m, i) => (
              <tr key={m.id}>
                <td className="border px-2 py-1">{i + 1}</td>
                <td className="border px-2 py-1">{m.name}</td>
                <td className="border px-2 py-1 text-right">
                  {Number(m.quantity)} {m.unit}
                </td>
                {staff && <td className="border px-2 py-1 text-right">{m.unitCost ? formatMoney(Number(m.unitCost) * Number(m.quantity)) : ""}</td>}
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - order.materials.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border px-2 py-3">{order.materials.length + i + 1}</td>
                <td className="border px-2 py-3" />
                <td className="border px-2 py-3" />
                {staff && <td className="border px-2 py-3" />}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">შენიშვნა</div>
        <div className="h-16 rounded border" />
      </section>

      <section className="grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="mb-8 text-xs text-neutral-500">შემსრულებელი (სახელი, ხელმოწერა)</div>
          <div className="border-t border-neutral-700" />
        </div>
        <div>
          <div className="mb-8 text-xs text-neutral-500">კლიენტის წარმომადგენელი (სახელი, ხელმოწერა, თარიღი)</div>
          <div className="border-t border-neutral-700" />
        </div>
      </section>

      <footer className="mt-8 text-center text-[10px] text-neutral-400">Line Net CRM · {order.number} · დაბეჭდილია {formatDate(new Date(), true)}</footer>
    </main>
  );
}
