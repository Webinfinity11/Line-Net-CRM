"use client";

import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addQuoteItem, removeQuoteItem, updateQuoteItem } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { QuoteItem } from "@/db/schema";
import { formatMoney } from "@/lib/i18n";
import { quoteTotals } from "./status";

export type ServiceOption = { id: number; name: string; unit: string; price: string };

/** The priced lines of an offer. Locked once the client has decided. */
export function QuoteLines({
  quoteId,
  items,
  catalogue,
  vatPercent,
  readOnly,
}: {
  quoteId: number;
  items: QuoteItem[];
  catalogue: ServiceOption[];
  vatPercent: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState("");
  const chosen = catalogue.find((c) => String(c.id) === picked);
  const { subtotal, vatRate, vat, total } = quoteTotals(items, vatPercent);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await addQuoteItem(quoteId, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        formRef.current?.reset();
        setPicked("");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  function save(itemId: number, quantity: number, unitPrice: number) {
    start(async () => {
      const res = await updateQuoteItem(itemId, quantity, unitPrice);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  function remove(itemId: number) {
    start(async () => {
      const res = await removeQuoteItem(itemId);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground [stroke-width:1.7]" /> პოზიციები
          <span className="text-[12px] font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">პოზიცია ჯერ არ არის. აირჩიეთ სერვისი სიიდან.</p>
        ) : (
          <>
            {/* phone: one card per line */}
            <ul className="space-y-2 sm:hidden">
              {items.map((i) => (
                <li key={i.id} className="rounded-[12px] border border-[#eef1f6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium">{i.name}</span>
                    {!readOnly && (
                      <Button variant="ghost" size="icon-xs" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => remove(i.id)}>
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
                          <Button variant="ghost" size="icon-xs" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => remove(i.id)}>
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="space-y-1.5 border-t border-[#eef1f6] pt-3 text-[12.5px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">ჯამი დღგ-ს გარეშე</dt>
                <dd className="tabular font-medium">{formatMoney(subtotal)}</dd>
              </div>
              {vatRate > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">დღგ {vatRate}%</dt>
                  <dd className="tabular font-medium">{formatMoney(vat)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <dt className="font-medium">სულ გადასახდელი</dt>
                <dd className="tabular font-heading text-[18px] font-semibold">{formatMoney(total)}</dd>
              </div>
            </dl>
          </>
        )}

        {readOnly ? (
          <p className="text-[11.5px] text-muted-foreground">გადაწყვეტილების შემდეგ პოზიციები აღარ იცვლება.</p>
        ) : (
          <form ref={formRef} onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_88px_110px_auto]">
            <NativeSelect name="serviceId" value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="სერვისი" className="h-11 text-[16px] sm:h-9 sm:text-[13px]">
              <NativeSelectOption value="">— აირჩიეთ სერვისი —</NativeSelectOption>
              {catalogue.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.name} · {formatMoney(c.price)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
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
            <input type="hidden" name="unit" value={chosen?.unit ?? "ცალი"} />
            <Button type="submit" variant="outline" disabled={pending} className="h-11 sm:h-9">
              <Plus className="size-4" /> დამატება
            </Button>
            {catalogue.length === 0 && (
              <p className="text-[11px] text-muted-foreground sm:col-span-4">სერვისების სია ცარიელია. შეავსეთ პარამეტრებში → სერვისები და ფასები.</p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
