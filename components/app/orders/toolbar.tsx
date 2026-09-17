"use client";

import { Download, Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { t } from "@/lib/i18n";

const SORTS: { key: string; label: string }[] = [
  { key: "created", label: "შექმნის თარიღი" },
  { key: "due", label: "ვადა" },
  { key: "priority", label: "პრიორიტეტი" },
  { key: "amount", label: "თანხა" },
];

/** Search + sort + filter toggle. The dropdown filters live in `children` and stay folded away. */
export function OrdersToolbar({
  q,
  sort,
  total,
  hidden,
  activeCount,
  excelHref,
  children,
}: {
  q: string;
  sort: string;
  total: number;
  hidden: Record<string, string>;
  activeCount: number;
  excelHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-3">
      <form ref={formRef} method="get" action="/orders" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e6ebf2] bg-white p-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="relative w-full min-w-[200px] sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.common.search}
            aria-label={t.common.search}
            className="h-9 w-full rounded-lg border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-3 text-[13px] outline-none transition focus:border-[#7f97e6] focus:bg-white"
          />
        </div>
        <span className="text-[12px] text-muted-foreground">{total} შეკვეთა</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="size-3.5" /> ფილტრები
            {activeCount > 0 && <span className="ml-0.5 rounded-full bg-[#eef2ff] px-1.5 text-[10px] font-semibold text-[#3457d5]">{activeCount}</span>}
          </Button>
          <NativeSelect
            name="sort"
            defaultValue={sort}
            aria-label="დალაგება"
            className="h-9 w-auto text-[13px]"
            onChange={() => formRef.current?.requestSubmit()}
          >
            {SORTS.map((s) => (
              <NativeSelectOption key={s.key} value={s.key}>
                დალაგება: {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button render={<a href={excelHref} />} variant="outline" size="sm" title="ყველა შეკვეთა Excel-ად">
            <Download className="size-3.5" /> Excel
          </Button>
        </div>
      </form>
      {open && children}
    </div>
  );
}
