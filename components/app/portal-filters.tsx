"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PORTAL_TABS, type PortalTab } from "@/lib/portal-tabs";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  months: { value: string; label: string }[];
  tab: PortalTab;
  q: string;
  siteId?: number;
  counts: Record<PortalTab, number>;
  sites: { id: number; name: string; address: string | null }[];
};

export function PortalFilters({ tab, q, siteId, counts, sites, month, months }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelSearch() {
    if (timer.current) clearTimeout(timer.current);
  }
  useEffect(() => {
    setQuery(q);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, tab, siteId, month]);

  function href(nextTab: PortalTab, nextQuery: string, nextSite = siteId ? String(siteId) : "", nextMonth = month) {
    const params = new URLSearchParams({ tab: nextTab });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextMonth) params.set("month", nextMonth);
    if (nextSite) params.set("site", nextSite);
    return `/portal?${params}`;
  }

  return (
    <div className="space-y-3">
      <nav aria-label="შეკვეთის სტატუსი" className="flex flex-wrap gap-1.5">
        {PORTAL_TABS.map((item) => (
          <Link key={item.key} href={href(item.key, query)} scroll={false} onClick={cancelSearch}
            aria-current={item.key === tab ? "page" : undefined}
            className={cn("inline-flex min-h-[44px] items-center gap-1 rounded-full border px-2 py-2 text-[11px] whitespace-nowrap", item.key === tab ? "border-primary bg-primary text-white dark:text-primary-foreground" : "border-border bg-card text-[#4a5a6c] dark:text-[var(--ln-strong)]")}>
            {item.label}<span className="text-[11px] tabular-nums">{counts[item.key]}</span>
          </Link>
        ))}
      </nav>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <Input aria-label="შეკვეთების ძებნა" placeholder="ნომერი, სათაური, მისამართი" className="h-11 min-w-0" value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            cancelSearch();
            timer.current = setTimeout(() => router.replace(href(tab, value), { scroll: false }), 300);
          }} />
        <NativeSelect aria-label="ობიექტი" className="h-11 w-full" value={siteId ? String(siteId) : ""}
          onChange={(event) => {
            cancelSearch();
            router.replace(href(tab, query, event.target.value), { scroll: false });
          }}>
          <option value="">ყველა ობიექტი</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name}{site.address ? ` · ${site.address}` : ""}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="თვე" className="h-11 w-full" value={month}
          onChange={(event) => {
            cancelSearch();
            router.replace(href(tab, query, siteId ? String(siteId) : "", event.target.value), { scroll: false });
          }}>
          <option value="">ყველა თვე</option>
          {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </NativeSelect>
      </div>
    </div>
  );
}
