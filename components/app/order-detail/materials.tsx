"use client";

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
      <CardContent className="space-y-3">
        {materials.length > 0 && (
          <div className="overflow-x-auto">
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
                          className="h-7 w-24 rounded border bg-transparent px-1.5 text-right text-sm"
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
                    <td className={margin === null ? "py-1 text-right text-muted-foreground" : margin >= 0 ? "py-1 text-right font-semibold text-[#25815a]" : "py-1 text-right font-semibold text-[#b13f32]"}>
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
          <form ref={formRef} onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <Input name="name" placeholder="მასალა, მაგ. UTP კაბელი" aria-label="მასალის დასახელება" required className="h-9" />
            </div>
            <Input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" className="h-9 w-20" aria-label="რაოდენობა" />
            <Input name="unit" defaultValue="ცალი" className="h-9 w-20" aria-label="ერთეული" />
            {financeVisible && <Input name="unitCost" type="number" step="0.01" min="0" placeholder="ფასი ₾" className="h-9 w-24" aria-label="ერთეულის ფასი" />}
            <Button type="submit" size="default" variant="outline" disabled={pending}>
              <Plus className="size-4" /> დამატება
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
