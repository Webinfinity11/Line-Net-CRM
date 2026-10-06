"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { KeepNumbers } from "@/components/app/keep-numbers";
import { toMtavruli } from "@/lib/mtavruli";

type TaskAlertItem = { id: number; title: string; body: string | null; href: string | null };

export function NewTaskAlert({ items, onOpen, onDismiss, onDismissAll }: {
  items: TaskAlertItem[];
  onOpen: (id: number) => void;
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}) {
  if (!items.length || typeof document === "undefined") return null;

  // Escape the topbar's backdrop-filter containing block and stacking context.
  return createPortal(
    <section role="status" aria-live="polite" aria-label="ახალი დავალებები"
      className="ln-card fixed left-[12px] right-[12px] top-[12px] z-[1000000000] max-h-[calc(100dvh-120px)] overflow-y-auto rounded-[20px] border-l-[4px] border-l-[#3457d5] bg-white p-[16px] shadow-[0_12px_40px_rgba(16,24,40,0.2)] sm:bottom-[24px] sm:left-auto sm:right-[24px] sm:top-auto sm:w-[360px]">
      <h2 className="mb-[12px] font-heading text-[14px] font-bold text-[#17212b]">
        {toMtavruli(items.length === 1 ? "ახალი დავალება" : `ახალი დავალებები (${items.length})`)}
      </h2>
      <ul className="divide-y divide-[#e5e9f0]">
        {items.slice(0, 5).map(item => (
          <li key={item.id} className="min-w-0 py-[12px] first:pt-0">
            <p className="break-words text-[13px] font-medium text-[#17212b]"><KeepNumbers text={item.title} /></p>
            {item.body && <p className="mt-[4px] truncate text-[12px] text-[#617084]" title={item.body}>{item.body}</p>}
            <div className="mt-[12px] flex gap-[8px]">
              <Button className="min-h-[44px]" render={<Link href={item.href ?? "/notifications"} />} onClick={() => onOpen(item.id)}>გახსნა</Button>
              <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => onDismiss(item.id)}>დახურვა</Button>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 1 && <Button type="button" variant="ghost" className="min-h-[44px] w-full" onClick={onDismissAll}>ყველას დახურვა</Button>}
    </section>, document.body,
  );
}
