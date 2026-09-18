"use client";

import { Download, Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ViewPrefs } from "@/components/app/view-prefs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { t } from "@/lib/i18n";

/** Columns anyone can switch off; the title and status always stay. */
const ORDER_COLUMNS = [
  { key: "number", label: "ნომერი" },
  { key: "system", label: "სისტემა" },
  { key: "crew", label: "შემსრულებლები" },
  { key: "due", label: "ვადა" },
  { key: "amount", label: "თანხა" },
];

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
      <form ref={formRef} method="get" action="/orders" className="ln-card flex flex-wrap items-center gap-2 p-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="relative w-full min-w-0 sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.common.search}
            aria-label={t.common.search}
            className="h-11 w-full rounded-lg border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-3 text-[16px] outline-none transition focus:border-[#7f97e6] focus:bg-white sm:h-9 sm:text-[13px]"
          />
        </div>
        <span className="shrink-0 text-[12px] text-muted-foreground">{total} შეკვეთა</span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="size-3.5" /> ფილტრები
            {activeCount > 0 && <span className="ml-0.5 rounded-full bg-[#eef2ff] px-1.5 text-[10px] font-semibold text-[#3457d5]">{activeCount}</span>}
          </Button>
          <NativeSelect
            name="sort"
            defaultValue={sort}
            aria-label="დალაგება"
            className="order-3 h-10 w-full basis-full text-[14px] sm:order-none sm:h-9 sm:w-auto sm:basis-auto sm:text-[13px]"
            onChange={() => formRef.current?.requestSubmit()}
          >
            {SORTS.map((s) => (
              <NativeSelectOption key={s.key} value={s.key}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <ViewPrefs storageKey="ln.orders.columns.v1" items={ORDER_COLUMNS} label="სვეტები" attr="data-col" />
          <Button render={<a href={excelHref} />} variant="outline" size="sm" className="h-10 sm:h-8" title="ყველა შეკვეთა Excel-ად">
            <Download className="size-3.5" /> Excel
          </Button>
        </div>
      </form>
      {open && children}
    </div>
  );
}
