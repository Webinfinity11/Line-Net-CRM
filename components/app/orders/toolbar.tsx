"use client";

import { ArrowDownWideNarrow, Download, Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ViewPrefs } from "@/components/app/view-prefs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { t } from "@/lib/i18n";

/** Columns anyone can switch off; the title and status always stay. */
const ORDER_COLUMNS = [
  { key: "number", label: "ნომერი" },
  { key: "system", label: "კატეგორია" },
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
      <form ref={formRef} method="get" action="/orders" className="ln-card flex flex-wrap items-center gap-2 p-3 max-md:gap-1.5">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="relative w-full min-w-0 sm:w-[320px] max-md:w-auto max-md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.common.search}
            aria-label={t.common.search}
            className="h-11 w-full rounded-lg border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-3 text-[16px] outline-none transition focus:border-[#7f97e6] focus:bg-white sm:h-9 sm:text-[13px]"
          />
        </div>
        <span className="max-md:hidden shrink-0 text-[12px] text-muted-foreground">{total} შეკვეთა</span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto max-md:w-auto max-md:gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 max-md:relative max-md:size-11 max-md:p-0" aria-label="ფილტრები" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="size-3.5" /> <span className="max-md:hidden">ფილტრები</span>
            {activeCount > 0 && <span className="max-md:absolute max-md:-right-1 max-md:-top-1 ml-0.5 rounded-full bg-[#eef2ff] px-1.5 text-[10px] font-semibold text-[#3457d5]">{activeCount}</span>}
          </Button>
          <div className="relative max-md:size-11">
          <ArrowDownWideNarrow aria-hidden className="pointer-events-none absolute left-[14px] top-[14px] size-4 md:hidden" />
          <NativeSelect
            name="sort"
            defaultValue={sort}
            aria-label="დალაგება"
            className="h-10 text-[14px] sm:h-9 sm:text-[13px] max-md:size-11 max-md:[&>select]:h-11 max-md:[&>select]:rounded-full max-md:[&>select]:text-transparent max-md:[&_option]:text-foreground max-md:[&>select]:cursor-pointer max-md:[&>svg]:hidden"
            onChange={() => formRef.current?.requestSubmit()}
          >
            {SORTS.map((s) => (
              <NativeSelectOption key={s.key} value={s.key}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          </div>
          <div className="max-md:hidden"><ViewPrefs storageKey="ln.orders.columns.v1" items={ORDER_COLUMNS} label="სვეტები" attr="data-col" /></div>
          <Button render={<a href={excelHref} />} variant="outline" size="sm" className="h-10 sm:h-8 max-md:size-11 max-md:p-0" aria-label="ყველა შეკვეთა Excel-ად" title="ყველა შეკვეთა Excel-ად">
            <Download className="size-3.5" /> <span className="max-md:hidden">Excel</span>
          </Button>
        </div>
      </form>
      {open && children}
    </div>
  );
}
