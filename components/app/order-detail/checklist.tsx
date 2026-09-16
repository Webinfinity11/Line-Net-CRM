"use client";

import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addChecklistItem, applyChecklistTemplate, removeChecklistItem, toggleChecklistItem } from "@/actions/order-work";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SYSTEM_LABELS, formatDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = { id: number; label: string; done: boolean; doneAt: Date | null; doneByUser: { id: string; name: string } | null };
type Template = { id: number; name: string; systemType: string };

export function Checklist({ orderId, items, templates, staff }: { orderId: number; items: Item[]; templates: Template[]; staff: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tpl, setTpl] = useState("");
  const [pending, start] = useTransition();
  const done = items.filter((i) => i.done).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "შეცდომა");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4 text-muted-foreground" /> {t.order.checklist}
          {items.length > 0 && (
            <span className={cn("text-sm font-normal", done === items.length ? "text-emerald-600" : "text-muted-foreground")}>
              {done}/{items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
          </div>
        )}
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="group flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <input
                type="checkbox"
                checked={i.done}
                disabled={pending}
                onChange={(e) => run(() => toggleChecklistItem(i.id, e.target.checked))}
                className="mt-0.5 size-4 accent-emerald-600"
              />
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", i.done && "text-muted-foreground line-through")}>{i.label}</div>
                {i.done && i.doneByUser && (
                  <div className="text-[11px] text-muted-foreground">
                    {i.doneByUser.name} · {formatDate(i.doneAt, true)}
                  </div>
                )}
              </div>
              {staff && (
                <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100" aria-label="წაშლა" onClick={() => run(() => removeChecklistItem(i.id))}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="text-sm text-muted-foreground">ჩეკ-ლისტი ცარიელია.</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = inputRef.current?.value ?? "";
            if (!v.trim()) return;
            run(async () => {
              const res = await addChecklistItem(orderId, v);
              if (res.ok && inputRef.current) inputRef.current.value = "";
              return res;
            });
          }}
          className="flex gap-2"
        >
          <Input ref={inputRef} placeholder="ახალი პუნქტი..." className="h-8 flex-1" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            <Plus className="size-3.5" />
          </Button>
        </form>
        {staff && templates.length > 0 && (
          <div className="flex gap-2">
            <NativeSelect value={tpl} onChange={(e) => setTpl(e.target.value)} className="h-8 flex-1 text-sm">
              <NativeSelectOption value="">შაბლონიდან დამატება...</NativeSelectOption>
              {templates.map((x) => (
                <NativeSelectOption key={x.id} value={String(x.id)}>
                  {SYSTEM_LABELS[x.systemType as keyof typeof SYSTEM_LABELS] ?? x.systemType}: {x.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button size="sm" variant="outline" disabled={!tpl || pending} onClick={() => run(() => applyChecklistTemplate(orderId, Number(tpl)))}>
              დამატება
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
