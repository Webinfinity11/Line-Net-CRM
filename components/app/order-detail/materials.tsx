"use client";
import { UnitInput } from "@/components/app/unit-input";

import { Package, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { addMaterial, removeMaterial, updateMaterialCost } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OrderMaterial } from "@/db/schema";
import { marginAfterMaterials, materialsCost } from "@/lib/finance";
import { formatMoney, t } from "@/lib/i18n";

/**
 * Materials list. `financeVisible` mirrors the server: for executors the server already
 * strips unitCost and amount, so the price column is simply absent from the data.
 */
export function Materials({
  orderId,
  materials,
  financeVisible,
  meId,
  amount,
  readOnly,
}: {
  orderId: number;
  materials: OrderMaterial[];
  financeVisible: boolean;
  meId: string;
  amount: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const cost = materialsCost(materials);
  const margin = marginAfterMaterials(amount, materials);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await addMaterial(orderId, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        formRef.current?.reset();
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" /> {t.order.materials}
          <span className="text-sm font-normal text-muted-foreground">{materials.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-3">
        {materials.length > 0 && (
          <ul className="divide-y divide-[#eef1f6] dark:divide-border sm:hidden">
            {materials.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">{m.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {Number(m.quantity)} {m.unit}
                    {financeVisible && m.unitCost ? ` · ${formatMoney(Number(m.unitCost) * Number(m.quantity))}` : ""}
                    {financeVisible && !m.unitCost ? " · ფასი არ არის" : ""}
                  </div>
                  {financeVisible && (
                    <label className="mt-2 block text-[11px] text-muted-foreground">
                      ერთ. ფასი
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`${m.name} ერთეულის ფასი`}
                        defaultValue={m.unitCost ?? ""}
                        placeholder="—"
                        disabled={readOnly}
                        className="mt-1 h-11 text-[16px]"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if ((v ?? null) === (m.unitCost === null ? null : Number(m.unitCost))) return;
                          start(async () => {
                            const res = await updateMaterialCost(m.id, v);
                            if (!res.ok) toast.error(res.error);
                            router.refresh();
                          });
                        }}
                      />
                    </label>
                  )}
                </div>
                {(financeVisible || m.createdBy === meId) && !readOnly && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-11"
                    aria-label={`${m.name} წაშლა`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await removeMaterial(m.id);
                        if (!res.ok) toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                )}
              </li>
            ))}
            {financeVisible && (
              <li className="space-y-1 py-2.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    მასალების ხარჯი{!cost.known && cost.missingPrices > 0 ? ` (${cost.missingPrices} პოზიციას ფასი აკლია)` : ""}
                  </span>
                  <span className="shrink-0 font-medium">{cost.known ? formatMoney(cost.cost) : "უცნობია"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">სხვაობა (თანხა − მასალები)</span>
                  <span className={margin === null ? "shrink-0 text-muted-foreground" : margin >= 0 ? "shrink-0 font-semibold text-[#25815a] dark:text-[var(--ln-success)]" : "shrink-0 font-semibold text-[#b13f32] dark:text-[var(--ln-alert)]"}>
                    {margin === null ? "—" : formatMoney(margin)}
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
        {materials.length > 0 && (
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">დასახელება</th>
                  <th className="py-1 text-right font-medium">რაოდ.</th>
                  {financeVisible && <th className="py-1 text-right font-medium">ერთ. ფასი</th>}
                  {financeVisible && <th className="py-1 text-right font-medium">ჯამი</th>}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-1.5">{m.name}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {Number(m.quantity)} {m.unit}
                    </td>
                    {financeVisible && (
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`${m.name} ერთეულის ფასი`}
                          defaultValue={m.unitCost ?? ""}
                          placeholder="—"
                          disabled={readOnly}
                          className="h-9 w-24 rounded border bg-transparent px-1.5 text-right text-[16px] sm:h-7 sm:text-sm"
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if ((v ?? null) === (m.unitCost === null ? null : Number(m.unitCost))) return;
                            start(async () => {
                              const res = await updateMaterialCost(m.id, v);
                              if (!res.ok) toast.error(res.error);
                              router.refresh();
                            });
                          }}
                        />
                      </td>
                    )}
                    {financeVisible && <td className="py-1.5 text-right whitespace-nowrap">{m.unitCost ? formatMoney(Number(m.unitCost) * Number(m.quantity)) : <span className="text-muted-foreground">ფასი არ არის</span>}</td>}
                    <td className="py-1.5 text-right">
                      {(financeVisible || m.createdBy === meId) && !readOnly && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`${m.name} წაშლა`}
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await removeMaterial(m.id);
                              if (!res.ok) toast.error(res.error);
                              router.refresh();
                            })
                          }
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {financeVisible && (
                <tfoot>
                  <tr className="border-t text-sm">
                    <td colSpan={3} className="py-1.5 text-right text-muted-foreground">
                      მასალების ხარჯი{!cost.known && cost.missingPrices > 0 ? ` (${cost.missingPrices} პოზიციას ფასი აკლია)` : ""}
                    </td>
                    <td className="py-1.5 text-right font-medium">{cost.known ? formatMoney(cost.cost) : "უცნობია"}</td>
                    <td />
                  </tr>
                  <tr className="text-sm">
                    <td colSpan={3} className="py-1 text-right text-muted-foreground">
                      სხვაობა მასალების ხარჯის შემდეგ (თანხა − მასალები)
                    </td>
                    <td className={margin === null ? "py-1 text-right text-muted-foreground" : margin >= 0 ? "py-1 text-right font-semibold text-[#25815a] dark:text-[var(--ln-success)]" : "py-1 text-right font-semibold text-[#b13f32] dark:text-[var(--ln-alert)]"}>
                      {margin === null ? "—" : formatMoney(margin)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {materials.length === 0 && <p className="text-sm text-muted-foreground">მასალები არ არის ჩაწერილი{financeVisible ? ", ხარჯი უცნობია" : ""}.</p>}
        {!readOnly && (
          <form ref={formRef} onSubmit={submit} className={`grid grid-cols-2 items-start gap-2 ${financeVisible ? "@min-[760px]:grid-cols-[minmax(180px,1fr)_88px_144px_110px_auto]" : "@min-[760px]:grid-cols-[minmax(180px,1fr)_88px_144px_auto]"}`}>
            <label className="col-span-2 grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground @min-[760px]:col-span-1">მასალის დასახელება
              <Input name="name" placeholder="მასალა, მაგ. UTP კაბელი" aria-label="მასალის დასახელება" required className="h-11 text-[16px] sm:text-[13px]" />
            </label>
            <label className="grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground">რაოდენობა<Input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]" aria-label="რაოდენობა" /></label>
            <UnitInput formRow label="საზომი ერთეული" name="unit" defaultValue="ცალი" className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]" aria-label="ერთეული" />
            {financeVisible && <label className="grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground">ფასი / ერთ. ₾<Input name="unitCost" type="number" step="0.01" min="0" placeholder="ფასი ₾" className="h-11 w-full min-w-0 text-[16px] sm:text-[13px]" aria-label="ერთეულის ფასი" /></label>}
            <Button type="submit" size="default" variant="outline" className={`mt-5 h-11 whitespace-nowrap ${financeVisible ? "" : "col-span-2 @min-[760px]:col-span-1"}`} disabled={pending}>
              <Plus className="size-4" /> დამატება
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
