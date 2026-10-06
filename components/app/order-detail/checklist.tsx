"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addChecklistItem, removeChecklistItem, toggleChecklistItem } from "@/actions/checklists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/i18n";

export type ChecklistRow = { id: number; label: string; done: boolean; required: boolean; doneAt: Date | null; doneByUser: { id: string; name: string } | null };
export function ChecklistItems({ orderId, items, disabled, staff = false, onChanged, onBusy }: { orderId: number; items: ChecklistRow[]; disabled?: boolean; staff?: boolean; onChanged?: () => Promise<void>; onBusy?: (busy: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    onBusy?.(true);
    start(async () => {
      try {
        const res = await action();
        if (!res.ok) toast.error(res.error);
        if (onChanged) await onChanged();
        router.refresh();
      } catch { toast.error("ვერ შეინახა. სცადეთ თავიდან"); }
      finally { onBusy?.(false); }
    });
  }
  return <div className="divide-y divide-[#eef1f6]">{items.map(item => <div key={item.id} className="flex items-center gap-2">
    <label className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-start gap-3 py-3 text-[14px]">
      <input type="checkbox" checked={item.done} disabled={disabled || pending} onChange={e => run(() => toggleChecklistItem(orderId, item.id, e.target.checked))} className="mt-1 size-[18px] shrink-0 accent-[#3457d5]" />
      <span className="min-w-0 break-words">{item.label}{item.required && <span className="ml-1 text-[12px] text-[#617084]">(სავალდებულო)</span>}
        {item.done && <span className="block text-[11px] text-[#617084]">{item.doneByUser?.name ?? "—"}{item.doneAt ? ` · ${formatDate(item.doneAt)}` : ""}</span>}
      </span>
    </label>
    {staff && !disabled && <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" className="size-[44px] shrink-0" aria-label="პუნქტის მოქმედებები" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={pending} className="min-h-[44px]" onClick={() => run(() => removeChecklistItem(orderId, item.id))}><Trash2 className="size-4" /> წაშლა</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
  </div>)}</div>;
}

export function Checklist({ orderId, items, staff, readOnly }: { orderId: number; items: ChecklistRow[]; staff: boolean; readOnly: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(true);
  const [pending, start] = useTransition();
  return <Card><CardHeader><CardTitle>ჩეკ-ლისტი</CardTitle></CardHeader><CardContent>
    {items.length ? <ChecklistItems orderId={orderId} items={items} staff={staff} disabled={readOnly || pending} /> : <p className="text-[13px] text-[#617084]">პუნქტები არ არის</p>}
    {staff && !readOnly && <form className="mt-3 space-y-2 border-t border-[#eef1f6] pt-3" onSubmit={e => { e.preventDefault(); start(async () => {
      const res = await addChecklistItem(orderId, label, required);
      if (!res.ok) { toast.error(res.error); return; }
      setLabel(""); router.refresh();
    }); }}>
      <Input aria-label="ახალი პუნქტი" placeholder="ახალი პუნქტი" value={label} onChange={e => setLabel(e.target.value)} required maxLength={500} className="h-[44px]" />
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-[44px] items-center gap-2 text-[13px]"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="accent-[#3457d5]" /> სავალდებულო</label><Button type="submit" variant="outline" className="h-[44px]" disabled={pending}>დამატება</Button></div>
    </form>}
  </CardContent></Card>;
}
