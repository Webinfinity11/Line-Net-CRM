"use client";

import { ClipboardCheck, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addChecklistItem, applyChecklistTemplate, removeChecklistItem, setChecklistItemRequired, toggleChecklistItem } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SYSTEM_LABELS, formatDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = { id: number; label: string; required: boolean; done: boolean; doneAt: Date | null; doneByUser: { id: string; name: string } | null };
type Template = { id: number; name: string; systemType: string };

export function Checklist({ orderId, items, templates, staff, readOnly }: { orderId: number; items: Item[]; templates: Template[]; staff: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [required, setRequired] = useState(false);
  const [tpl, setTpl] = useState("");
  const [pending, start] = useTransition();
  const done = items.filter((i) => i.done).length;
  const requiredLeft = items.filter((i) => i.required && !i.done).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "შეცდომა");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-1">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" /> {t.order.checklist}
          {items.length > 0 && (
            <span className={cn("text-sm font-normal", done === items.length ? "text-[#25815a]" : "text-muted-foreground")}>
              {done}/{items.length}
            </span>
          )}
        </CardTitle>
        {requiredLeft > 0 && <span className="text-xs font-medium text-[#96610b]">{requiredLeft} სავალდებულო დარჩა</span>}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((done / Math.max(1, items.length)) * 100)}%` }} />
          </div>
        )}
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="group flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <input
                id={`chk-${i.id}`}
                type="checkbox"
                checked={i.done}
                disabled={pending || readOnly}
                onChange={(e) => run(() => toggleChecklistItem(i.id, e.target.checked))}
                className="mt-0.5 size-4 accent-emerald-600"
              />
              <label htmlFor={`chk-${i.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className={cn("text-sm", i.done && "text-muted-foreground line-through")}>
                  {i.label}
                  {i.required && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800" title="სავალდებულო">
                      <Star className="size-2.5" /> სავალდებულო
                    </span>
                  )}
                </span>
                {i.done && i.doneByUser && (
                  <span className="block text-[11px] text-muted-foreground">
                    {i.doneByUser.name} · {formatDate(i.doneAt, true)}
                  </span>
                )}
              </label>
              {staff && !readOnly && (
                <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="ghost" size="icon-xs" aria-label={i.required ? "სავალდებულოობის მოხსნა" : "სავალდებულოდ მონიშვნა"} onClick={() => run(() => setChecklistItemRequired(i.id, !i.required))}>
                    <Star className={cn("size-3.5", i.required ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label="პუნქტის წაშლა" onClick={() => run(() => removeChecklistItem(i.id))}>
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="text-sm text-muted-foreground">ჩეკ-ლისტი ცარიელია. {staff ? "დაამატეთ პუნქტი ან შაბლონი." : ""}</p>}
        {!readOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = inputRef.current?.value ?? "";
              if (!v.trim()) return;
              run(async () => {
                const res = await addChecklistItem(orderId, v, required);
                if (res.ok && inputRef.current) inputRef.current.value = "";
                return res;
              });
            }}
            className="flex flex-wrap gap-2"
          >
            <Input ref={inputRef} placeholder="ახალი პუნქტი..." aria-label="ახალი პუნქტი" className="h-9 min-w-[180px] flex-1" />
            {staff && (
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-amber-500" /> სავალდებულო
              </label>
            )}
            <Button type="submit" size="default" variant="outline" disabled={pending}>
              <Plus className="size-4" /> დამატება
            </Button>
          </form>
        )}
        {staff && !readOnly && templates.length > 0 && (
          <div className="flex gap-2">
            <NativeSelect value={tpl} onChange={(e) => setTpl(e.target.value)} aria-label="ჩეკ-ლისტის შაბლონი" className="h-9 flex-1 text-sm">
              <NativeSelectOption value="">შაბლონიდან დამატება...</NativeSelectOption>
              {templates.map((x) => (
                <NativeSelectOption key={x.id} value={String(x.id)}>
                  {SYSTEM_LABELS[x.systemType as keyof typeof SYSTEM_LABELS] ?? x.systemType}: {x.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button size="default" variant="outline" disabled={!tpl || pending} onClick={() => run(() => applyChecklistTemplate(orderId, Number(tpl)))}>
              დამატება
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
