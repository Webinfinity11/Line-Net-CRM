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
import { formatMoney, t } from "@/lib/i18n";

export function Materials({
  orderId,
  materials,
  staff,
  meId,
  amount,
}: {
  orderId: number;
  materials: OrderMaterial[];
  staff: boolean;
  meId: string;
  amount: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const cost = materials.reduce((sum, m) => sum + (m.unitCost ? Number(m.unitCost) * Number(m.quantity) : 0), 0);
  const profit = amount ? Number(amount) - cost : null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addMaterial(orderId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="size-4 text-muted-foreground" /> {t.order.materials}
          <span className="text-sm font-normal text-muted-foreground">{materials.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {materials.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-medium">დასახელება</th>
                <th className="py-1 text-right font-medium">რაოდ.</th>
                {staff && <th className="py-1 text-right font-medium">ერთ. ფასი</th>}
                {staff && <th className="py-1 text-right font-medium">ჯამი</th>}
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
                  {staff && (
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={m.unitCost ?? ""}
                        placeholder="0.00"
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
                  {staff && <td className="py-1.5 text-right whitespace-nowrap">{m.unitCost ? formatMoney(Number(m.unitCost) * Number(m.quantity)) : "—"}</td>}
                  <td className="py-1.5 text-right">
                    {(staff || m.createdBy === meId) && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="წაშლა"
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
            {staff && (
              <tfoot>
                <tr className="border-t text-sm">
                  <td colSpan={3} className="py-1.5 text-right text-muted-foreground">
                    ხარჯი
                  </td>
                  <td className="py-1.5 text-right font-medium">{formatMoney(cost)}</td>
                  <td />
                </tr>
                {profit !== null && (
                  <tr className="text-sm">
                    <td colSpan={3} className="py-1 text-right text-muted-foreground">
                      მოგება (თანხა − ხარჯი)
                    </td>
                    <td className={profit >= 0 ? "py-1 text-right font-semibold text-emerald-700" : "py-1 text-right font-semibold text-rose-700"}>{formatMoney(profit)}</td>
                    <td />
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        )}
        <form ref={formRef} onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <Input name="name" placeholder="მასალა, მაგ. UTP კაბელი" required className="h-8" />
          </div>
          <Input name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" className="h-8 w-20" aria-label="რაოდენობა" />
          <Input name="unit" defaultValue="ცალი" className="h-8 w-20" aria-label="ერთეული" />
          {staff && <Input name="unitCost" type="number" step="0.01" min="0" placeholder="ფასი ₾" className="h-8 w-24" aria-label="ერთეულის ფასი" />}
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            <Plus className="size-3.5" /> დამატება
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
