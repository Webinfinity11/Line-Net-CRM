"use client";

import { ArrowDownWideNarrow, Download, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PeriodFilter } from "@/components/app/period-filter";
import { Button } from "@/components/ui/button";
import { ViewPrefs } from "@/components/app/view-prefs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** Columns anyone can switch off; the title and status always stay. */
const ORDER_COLUMNS = [
  { key: "number", label: "ნომერი" },
  { key: "client", label: "კლიენტი" },
  { key: "system", label: "კატეგორია" },
  { key: "crew", label: "შემსრულებლები" },
  { key: "due", label: "ვადა" },
  { key: "amount", label: "თანხა" },
];

const SORTS: { key: string; label: string }[] = [
  { key: "", label: "ახალი ზემოთ" },
  { key: "due", label: "ვადა" },
  { key: "priority", label: "პრიორიტეტი" },
  { key: "amount", label: "თანხა" },
];

/** Search + sort + filter toggle. The dropdown filters live in `children` and stay folded away. */
export function OrdersToolbar({
  q,
  month,
  months,
  sort,
  total,
  hidden,
  activeCount,
  excelHref,
  children,
}: {
  q: string;
  month: string;
  months: { value: string; label: string }[];
  sort: string;
  total: number;
  hidden: Record<string, string>;
  activeCount: number;
  excelHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(q);
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);

  return (
    <div className="space-y-3">
      <form ref={formRef} method="get" action="/orders" onSubmit={event => {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value.trim()) next.set(key, value.trim());
        }
        router.push(`/orders${next.size ? `?${next}` : ""}`, { scroll: false });
      }} className="ln-card flex flex-wrap items-center gap-2 p-3 max-md:gap-1.5">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="relative w-full min-w-0 md:w-[220px] md:shrink-0">
          <button type="submit" aria-label="ძიება" className="absolute inset-y-0 left-0 grid w-9 cursor-pointer place-items-center rounded-l-full text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
            <Search className="size-4" />
          </button>
          <input
            name="q"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="ნომერი, სათაური, მისამართი…"
            aria-label="შეკვეთების ძიება"
            onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            className="h-11 w-full rounded-full border border-border bg-[#f6fafb] dark:bg-muted pl-9 pr-3 text-[16px] outline-none transition focus:border-ring focus:bg-card md:h-9 md:text-[13px]"
          />
        </div>
        <input type="hidden" name="month" value={month || "all"} />
        <PeriodFilter compact value={month} months={months} onChange={(value) => {
          const input = formRef.current?.querySelector<HTMLInputElement>('input[name="month"]');
          if (input) input.value = value || "all";
          formRef.current?.requestSubmit();
        }} />
        <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto md:flex-nowrap max-md:w-auto max-md:gap-1.5">
          <span className="mr-1 hidden shrink-0 text-[12px] tabular text-muted-foreground md:inline">{total} შეკვეთა</span>
          <Button type="button" variant="outline" size="sm" className="h-9 max-md:relative max-md:size-11 max-md:p-0" aria-label="ფილტრები" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="size-3.5" /> <span className="max-md:hidden">ფილტრები</span>
            {activeCount > 0 && <span className="max-md:absolute max-md:-right-1 max-md:-top-1 ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">{activeCount}</span>}
          </Button>
          <div className="relative max-md:size-11">
          <ArrowDownWideNarrow aria-hidden className="pointer-events-none absolute left-[14px] top-[14px] size-4 md:hidden" />
          <NativeSelect
            variant="toolbar"
            name="sort"
            value={sort === "created" ? "" : sort}
            aria-label="დალაგება"
            className="h-9 text-[14px] md:text-[13px] max-md:size-11 max-md:[&_button]:rounded-full max-md:[&_[data-slot=select-value]]:invisible max-md:[&_svg]:hidden"
            onChange={() => formRef.current?.requestSubmit()}
          >
            {SORTS.map((s) => (
              <NativeSelectOption key={s.key} value={s.key}>
                {s.key === "" && ["done", "closed"].includes(params.get("status") ?? "") ? "ბოლოს დასრულებული ზემოთ" : s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          </div>
          <div className="max-md:hidden [&_button]:h-9"><ViewPrefs storageKey="ln.orders.columns.v1" items={ORDER_COLUMNS} label="სვეტები" attr="data-col" /></div>
          <Button render={<a href={excelHref} />} variant="outline" size="sm" className="h-9 max-md:size-11 max-md:p-0 xl:px-3.5 max-xl:size-9 max-xl:p-0 max-md:size-11" aria-label="ყველა შეკვეთა Excel-ად, კატეგორიების მიხედვით" title="ყველა შეკვეთა Excel-ად, კატეგორიების მიხედვით">
            <Download className="size-3.5" /> <span className="max-xl:hidden">Excel</span>
          </Button>
        </div>
      </form>
      {open && children}
    </div>
  );
}

/** Change just the manager filter, retaining the current query including repeated keys. */
export function ManagerFilter({ value, users }: { value: string; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <NativeSelect name="manager" value={value} aria-label="პასუხისმგებელი"
    className="h-[36px] w-full rounded-[8px] bg-card text-[13px] sm:w-[240px]"
    onChange={event => {
      const params = new URLSearchParams(searchParams.toString());
      if (event.target.value) params.set("manager", event.target.value);
      else params.delete("manager");
      params.delete("page");
      router.push(`${pathname}${params.size ? `?${params}` : ""}`);
    }}>
    <NativeSelectOption value="">პასუხისმგებელი: ყველა</NativeSelectOption>
    <NativeSelectOption value="mine">პასუხისმგებელი: ჩემი</NativeSelectOption>
    {users.map(user => <NativeSelectOption key={user.id} value={user.id}>{user.name}</NativeSelectOption>)}
  </NativeSelect>;
}
