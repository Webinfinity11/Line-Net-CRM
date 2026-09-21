"use client";

import { Plus, ReceiptText, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addOrderItem, removeOrderItem, updateOrderItem } from "@/actions/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { useSystems } from "@/components/app/systems-provider";
import type { OrderItem } from "@/db/schema";
import { formatMoney } from "@/lib/i18n";
import { vatBreakdown } from "@/lib/finance";

export type ServiceOption = { id: number; name: string; unit: string; price: string; systemType: string | null };

/** Sentinel in the service list: the row switches to a typed line instead of a pick. */
const MANUAL = "__manual__";

/** Billable lines. The order total follows this list, so the manager edits prices here. */
export function OrderServices({ orderId, items, catalogue, readOnly, vatPercent, orderSystemType }: { orderId: number; orderSystemType?: string | null; items: OrderItem[]; catalogue: ServiceOption[]; readOnly?: boolean; vatPercent?: string | number | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState("");
  const [manual, setManual] = useState(false);
  const sums = vatBreakdown(items, vatPercent);
  const chosen = catalogue.find((c) => String(c.id) === picked);
  const groups = useCategoryGroups(catalogue, orderSystemType);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await addOrderItem(orderId, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        formRef.current?.reset();
        setPicked("");
        setManual(false);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  function save(itemId: number, quantity: number, unitPrice: number) {
    start(async () => {
      const res = await updateOrderItem(itemId, quantity, unitPrice);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground [stroke-width:1.7]" /> სერვისები და ფასები
          <span className="text-[12px] font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">პოზიცია ჯერ არ არის. აირჩიეთ სერვისი სიიდან ან ჩაწერეთ ხელით.</p>
        ) : (
          <>
            {/* phone: one card per line */}
            <ul className="space-y-2 sm:hidden">
              {items.map((i) => (
                <li key={i.id} className="rounded-[12px] border border-[#eef1f6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium">{i.name}</span>
                    {!readOnly && (
                      <Button variant="ghost" size="icon-xs" className="-mr-2 -mt-2 size-11" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => start(async () => { const r = await removeOrderItem(i.id); if (!r.ok) toast.error(r.error); router.refresh(); })}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      რაოდენობა
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={Number(i.quantity)}
                        disabled={readOnly}
                        className="mt-1 h-11 text-[16px]"
                        onBlur={(e) => save(i.id, Number(e.target.value), Number(i.unitPrice))}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      ფასი ({i.unit})
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={Number(i.unitPrice)}
                        disabled={readOnly}
                        className="mt-1 h-11 text-[16px]"
                        onBlur={(e) => save(i.id, Number(i.quantity), Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="tabular mt-2 text-right text-[13px] font-semibold">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="py-1.5 font-normal">დასახელება</th>
                    <th className="w-24 py-1.5 text-right font-normal">რაოდ.</th>
                    <th className="w-28 py-1.5 text-right font-normal">ერთ. ფასი</th>
                    <th className="w-28 py-1.5 text-right font-normal">ჯამი</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-[#eef1f6]">
                      <td className="py-2">
                        {i.name}
                        <span className="ml-1 text-[11px] text-muted-foreground">{i.unit}</span>
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          defaultValue={Number(i.quantity)}
                          disabled={readOnly}
                          aria-label={`${i.name} რაოდენობა`}
                          className="tabular h-8 w-20 rounded-md border border-[#dbe1ec] bg-transparent px-2 text-right"
                          onBlur={(e) => save(i.id, Number(e.target.value), Number(i.unitPrice))}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={Number(i.unitPrice)}
                          disabled={readOnly}
                          aria-label={`${i.name} ფასი`}
                          className="tabular h-8 w-24 rounded-md border border-[#dbe1ec] bg-transparent px-2 text-right"
                          onBlur={(e) => save(i.id, Number(i.quantity), Number(e.target.value))}
                        />
                      </td>
                      <td className="tabular py-2 text-right font-medium">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</td>
                      <td className="py-2 text-right">
                        {!readOnly && (
                          <Button variant="ghost" size="icon-xs" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => start(async () => { const r = await removeOrderItem(i.id); if (!r.ok) toast.error(r.error); router.refresh(); })}>
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 border-t border-[#eef1f6] pt-3">
              {sums.rate > 0 && (
                <>
                  <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span>ჯამი დღგ-ს გარეშე</span>
                    <span className="tabular">{formatMoney(sums.net)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                    <span>დღგ {sums.rate}%</span>
                    <span className="tabular">{formatMoney(sums.vat)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">შეკვეთის ჯამი</span>
                <span className="tabular font-heading text-[18px] font-semibold">{formatMoney(sums.gross)}</span>
              </div>
            </div>
          </>
        )}

        {!readOnly && (
          <form ref={formRef} onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_88px_110px_auto]">
            {/* not every job is in the catalogue: the same row takes a typed line too */}
            {manual ? (
              <div className="grid min-w-0 grid-cols-[1fr_44px] gap-2 md:flex">
                <Input name="name" placeholder="დასახელება" aria-label="პოზიციის დასახელება" className="col-span-2 h-11 min-w-0 flex-1 text-[16px] sm:h-9 sm:text-[13px]" required autoFocus />
                <Input name="unit" defaultValue="ცალი" aria-label="ერთეული" className="h-11 w-full md:w-[74px] shrink-0 text-[16px] sm:h-9 sm:text-[13px]" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="სიაში დაბრუნება"
                  title="სიაში დაბრუნება"
                  className="h-11 w-11 shrink-0 md:h-9 md:w-9"
                  onClick={() => setManual(false)}
                >
                  <X className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <NativeSelect
                name="serviceId"
                value={picked}
                onChange={(e) => {
                  if (e.target.value === MANUAL) {
                    setManual(true);
                    setPicked("");
                    return;
                  }
                  setPicked(e.target.value);
                }}
                aria-label="სერვისი"
                className="h-11 text-[16px] sm:h-9 sm:text-[13px] max-md:w-full max-md:min-w-0 max-md:[&_select]:h-11 max-md:[&_select]:text-[16px]"
              >
                <NativeSelectOption value="">— აირჩიეთ სერვისი —</NativeSelectOption>
                <NativeSelectOption value={MANUAL}>✎ ჩაწერა ხელით</NativeSelectOption>
                {groups.map((g) => (
                  <NativeSelectOptGroup key={g.key} label={g.name}>
                    {g.items.map((c) => (
                      <NativeSelectOption key={c.id} value={String(c.id)}>
                        {c.name} · {formatMoney(c.price)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            )}
            <Input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" aria-label="რაოდენობა" className="h-11 text-[16px] sm:h-9 sm:text-[13px]" />
            <Input
              key={picked}
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={chosen ? Number(chosen.price) : ""}
              placeholder="ფასი ₾"
              aria-label="ერთეულის ფასი"
              className="h-11 text-[16px] sm:h-9 sm:text-[13px]"
              required
            />
            {!manual && <input type="hidden" name="unit" value={chosen?.unit ?? "ცალი"} />}
            <Button type="submit" variant="outline" disabled={pending} className="h-11 sm:h-9">
              <Plus className="size-4" /> დამატება
            </Button>
            {catalogue.length === 0 && (
              <p className="text-[11px] text-muted-foreground sm:col-span-4">
                სერვისების სია ცარიელია. შეავსეთ პარამეტრებში → სერვისები და ფასები.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Prefer the order category, keeping the admin order for all other groups. */
function useCategoryGroups(catalogue: ServiceOption[], orderSystemType?: string | null) {
  return categoryGroups(catalogue, useSystems(), orderSystemType);
}

function categoryGroups(catalogue: ServiceOption[], systems: { key: string; name: string }[], orderSystemType?: string | null) {
  const rank = new Map(systems.map((s, i) => [s.key, i]));
  const name = new Map(systems.map((s) => [s.key, s.name]));
  const byKey = new Map<string, ServiceOption[]>();
  for (const c of catalogue) {
    const key = c.systemType && name.has(c.systemType) ? c.systemType : "";
    byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }
  return [...byKey.entries()]
    .map(([key, items]) => ({ key, name: key ? name.get(key)! : "კატეგორიის გარეშე", items }))
    .sort((a, b) => {
      const priority = (key: string) => key && key === orderSystemType ? -1 : (rank.get(key) ?? systems.length);
      return priority(a.key) - priority(b.key);
    });
}
