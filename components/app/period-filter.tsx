"use client";

import { RotateCcw } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { MONTHS } from "@/lib/month-filter";
import { cn } from "@/lib/utils";

/** Keep the existing month URL parameter compatible: YYYY or YYYY-MM. */
export function PeriodFilter({ value, months, onChange, className, compact = false }: {
  value: string;
  months: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [year = "", month = ""] = value.split("-");
  const years = [...new Set([...months.map(item => item.value.slice(0, 4)), ...(year ? [year] : [])])].sort().reverse();
  return <div role="group" aria-label="პერიოდი" className={cn("flex w-full flex-wrap items-end gap-2 sm:w-auto", className)}>
    <label className={cn("min-w-0 flex-1 space-y-1 text-xs text-muted-foreground sm:flex-none", compact && "space-y-0")}>
      <span className={compact ? "sr-only" : "block"}>წელი</span>
      <NativeSelect aria-label="წელი" value={year} className={cn("h-11 w-full sm:w-[140px]", compact && "md:h-9 md:w-[104px]")}
        onChange={event => onChange(event.target.value ? `${event.target.value}${month ? `-${month}` : ""}` : "")}>
        <option value="">ყველა წელი</option>
        {years.map(item => <option key={item} value={item}>{item}</option>)}
      </NativeSelect>
    </label>
    <label className={cn("min-w-0 flex-1 space-y-1 text-xs text-muted-foreground sm:flex-none", compact && "space-y-0")}>
      <span className={compact ? "sr-only" : "block"}>თვე</span>
      <NativeSelect aria-label="თვე" value={month} disabled={!year} className={cn("h-11 w-full sm:w-[160px]", compact && "md:h-9 md:w-[132px]")}
        onChange={event => onChange(`${year}${event.target.value ? `-${event.target.value}` : ""}`)}>
        <option value="">ყველა თვე</option>
        {MONTHS.map((label, index) => <option key={label} value={String(index + 1).padStart(2, "0")}>{label}</option>)}
      </NativeSelect>
    </label>
    {value && <Button type="button" variant="ghost" aria-label="ყველა პერიოდი" title="ყველა პერიოდი" className={cn("h-11 shrink-0", compact && "w-11 p-0 md:size-9")} onClick={() => onChange("")}>{compact ? <RotateCcw className="size-4" /> : "ყველა პერიოდი"}</Button>}
  </div>;
}
