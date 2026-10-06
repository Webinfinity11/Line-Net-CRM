"use client";
import { UnitInput } from "@/components/app/unit-input";

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
import { compareServiceSubgroups } from "@/lib/service-groups";
import { vatBreakdown } from "@/lib/finance";

export type ServiceOption = { id: number; name: string; unit: string; price: string | null; systemType: string | null; subgroupName?: string | null };

/** Sentinel in the service list: the row switches to a typed line instead of a pick. */
const MANUAL = "__manual__";

/** Billable lines. The order total follows this list, so the manager edits prices here. */
export function OrderServices({ orderId, items, catalogue, readOnly, vatPercent, orderSystemType, executorId, financeVisible }: { financeVisible: boolean; orderId: number; orderSystemType?: string | null; executorId?: string; items: (Omit<OrderItem, "unitPrice"> & { unitPrice: string | null; creator?: { name: string; role: string } | null })[]; catalogue: ServiceOption[]; readOnly?: boolean; vatPercent?: string | number | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState("");
  const [manual, setManual] = useState(false);
  const sums = financeVisible ? vatBreakdown(items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice ?? "0" })), vatPercent) : null;
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

  function save(itemId: number, quantity: number, unitPrice?: number) {
    start(async () => {
      const res = financeVisible
        ? await updateOrderItem(itemId, quantity, unitPrice)
        : await updateOrderItem(itemId, quantity);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground [stroke-width:1.7]" /> {financeVisible ? "სერვისები და ფასები" : "სერვისები"}
          <span className="text-[12px] font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-3">
        {items.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">პოზიცია ჯერ არ არის. აირჩიეთ სერვისი სიიდან ან ჩაწერეთ ხელით.</p>
        ) : (
          <>
            {/* phone: one card per line */}
            <ul className="space-y-2 sm:hidden">
              {items.map((i) => (
                <li key={i.id} className="border-b border-[#eef1f6] py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium">{i.name}{i.creator?.role === "executor" && <small className="block text-muted-foreground">დაამატა: {i.creator.name}</small>}</span>
                    {!readOnly && (!executorId || i.createdBy === executorId) && (
                      <details><summary className="cursor-pointer px-2" aria-label="პოზიციის მოქმედებები">⋯</summary><Button variant="ghost" size="icon-xs" className="size-11" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => start(async () => { const r = await removeOrderItem(i.id); if (!r.ok) toast.error(r.error); router.refresh(); })}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button></details>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      რაოდენობა{!financeVisible && ` (${i.unit})`}
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={Number(i.quantity)}
                        disabled={readOnly || Boolean(executorId && i.createdBy !== executorId)}
                        className="mt-1 h-11 text-[16px]"
                        onBlur={(e) => save(i.id, Number(e.target.value), financeVisible ? Number(i.unitPrice) : undefined)}
                      />
                    </label>
                    {financeVisible && <label className="text-[11px] text-muted-foreground">
                      ფასი ({i.unit})
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={Number(i.unitPrice)}
                        disabled={readOnly || Boolean(executorId && i.createdBy !== executorId)}
                        className="mt-1 h-11 text-[16px]"
                        onBlur={(e) => save(i.id, Number(i.quantity), Number(e.target.value))}
                      />
                    </label>}
                  </div>
                  {financeVisible && <div className="tabular mt-2 text-right text-[13px] font-semibold">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</div>}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground">
                    <th className="py-1.5 font-normal">დასახელება</th>
                    <th className="w-24 py-1.5 text-right font-normal">რაოდ.</th>
                    {financeVisible && <th className="w-28 py-1.5 text-right font-normal">ერთ. ფასი</th>}
                    {financeVisible && <th className="w-28 py-1.5 text-right font-normal">ჯამი</th>}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-[#eef1f6]">
                      <td className="py-2">
                        {i.name}{i.creator?.role === "executor" && <small className="block text-muted-foreground">დაამატა: {i.creator.name}</small>}
                        <span className="ml-1 text-[11px] text-muted-foreground">{i.unit}</span>
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          defaultValue={Number(i.quantity)}
                          disabled={readOnly || Boolean(executorId && i.createdBy !== executorId)}
                          aria-label={`${i.name} რაოდენობა`}
                          className="tabular h-8 w-20 rounded-md border border-[#dbe1ec] bg-transparent px-2 text-right"
                          onBlur={(e) => save(i.id, Number(e.target.value), financeVisible ? Number(i.unitPrice) : undefined)}
                        />
                      </td>
                      {financeVisible && <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={Number(i.unitPrice)}
                          disabled={readOnly || Boolean(executorId && i.createdBy !== executorId)}
                          aria-label={`${i.name} ფასი`}
                          className="tabular h-8 w-24 rounded-md border border-[#dbe1ec] bg-transparent px-2 text-right"
                          onBlur={(e) => save(i.id, Number(i.quantity), Number(e.target.value))}
                        />
                      </td>}
                      {financeVisible && <td className="tabular py-2 text-right font-medium">{formatMoney(Number(i.quantity) * Number(i.unitPrice))}</td>}
                      <td className="py-2 text-right">
                        {!readOnly && (!executorId || i.createdBy === executorId) && (
                          <details><summary className="cursor-pointer px-2" aria-label="პოზიციის მოქმედებები">⋯</summary><Button variant="ghost" size="icon-xs" aria-label={`${i.name} წაშლა`} disabled={pending} onClick={() => start(async () => { const r = await removeOrderItem(i.id); if (!r.ok) toast.error(r.error); router.refresh(); })}>
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button></details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sums && <div className="space-y-1.5 border-t border-[#eef1f6] pt-3">
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
            </div>}
          </>
        )}

        {!readOnly && (
          <form ref={formRef} onSubmit={submit} className={`grid grid-cols-2 items-start gap-2 ${financeVisible ? "@min-[760px]:grid-cols-[minmax(180px,1fr)_88px_144px_110px_auto]" : "@min-[760px]:grid-cols-[minmax(180px,1fr)_88px_144px_auto]"}`}>
            {/* not every job is in the catalogue: the same row takes a typed line too */}
            <div className="col-span-2 grid min-w-0 gap-1 @min-[760px]:col-span-1">
            <span className="text-[12px] leading-4 text-muted-foreground">სერვისის დასახელება</span>
            {manual ? (
              <div className="flex min-w-0 gap-2">
                <Input name="name" placeholder="დასახელება" aria-label="პოზიციის დასახელება" className="h-11 min-w-0 flex-1 text-[16px] sm:text-[13px]" required autoFocus />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="სიაში დაბრუნება"
                  title="სიაში დაბრუნება"
                  className="h-11 w-11 shrink-0"
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
                className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]"
              >
                <NativeSelectOption value="">— აირჩიეთ სერვისი —</NativeSelectOption>
                <NativeSelectOption value={MANUAL}>✎ ჩაწერა ხელით</NativeSelectOption>
                {groups.map((g) => (
                  <NativeSelectOptGroup key={g.key} label={g.name}>
                    {g.items.map((c) => (
                      <NativeSelectOption key={c.id} value={String(c.id)}>
                        {c.subgroupName ? `${c.subgroupName} — ` : ""}{c.name}{financeVisible && <> · {formatMoney(c.price)}</>}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            )}
            </div>
            <label className="grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground">რაოდენობა<Input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" aria-label="რაოდენობა" className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]" /></label>
            <UnitInput key={`unit-${manual}-${picked}`} formRow label="საზომი ერთეული" name="unit" defaultValue={chosen?.unit ?? "ცალი"} aria-label="ერთეული" className="w-full text-[16px] sm:text-[13px]" />
            {financeVisible && <label className="grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground">ფასი / ერთ. ₾<Input
              key={picked}
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={chosen ? Number(chosen.price) : ""}
              placeholder="ფასი ₾"
              aria-label="ერთეულის ფასი"
              className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]"
              required
            /></label>}
            <Button type="submit" variant="outline" disabled={pending} className={`mt-5 h-11 whitespace-nowrap ${financeVisible ? "" : "col-span-2 @min-[760px]:col-span-1"}`}>
              <Plus className="size-4" /> დამატება
            </Button>
            {catalogue.length === 0 && (
              <p className="col-span-full text-[11px] text-muted-foreground">
                {financeVisible ? "სერვისების სია ცარიელია. შეავსეთ პარამეტრებში → სერვისები და ფასები." : "სერვისების სია ცარიელია. ჩაწერეთ ხელით."}
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
  return categoryGroups(catalogue, useSystems(), orderSystemType).map(g => ({ ...g, items: [...g.items].sort(compareServiceSubgroups) }));
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
