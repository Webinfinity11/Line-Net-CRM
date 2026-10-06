"use client";

import { DateField } from "@/components/ui/date-field";
import { CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Any stretch of days, for when the three presets are not the question being asked. */
export function PeriodPicker({ from, to, active }: { from?: string; to?: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(from ?? "");
  const [b, setB] = useState(to ?? "");
  const valid = a && b && a <= b;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="პერიოდი"
            className={cn("h-9 max-md:size-11 max-md:shrink-0 max-md:p-0", active && "border-[#a5b5ed] bg-[#eef2ff] text-[#3457d5]")}
          />
        }
      >
        <CalendarRange className="size-4" />
        <span className="max-md:hidden">{active && a && b ? periodLabel(a, b) : "პერიოდი"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] p-3">
        <div className="mb-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">აირჩიეთ შუალედი</div>
        <div className="grid gap-2">
          <label className="grid gap-1 text-[11.5px] text-muted-foreground">
            დაწყება
            <DateField value={a} onChange={setA} />
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted-foreground">
            დასრულება
            <DateField value={b} onChange={setB} />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="max-md:min-h-[44px] h-9 flex-1"
            disabled={!valid}
            onClick={() => {
              setOpen(false);
              router.push(`/?from=${a}&to=${b}`);
            }}
          >
            ჩვენება
          </Button>
          {active && (
            <Button
              variant="outline"
              size="sm"
              className="max-md:min-h-[44px] h-9"
              onClick={() => {
                setOpen(false);
                router.push("/?range=week");
              }}
            >
              გასუფთავება
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "01.09 – 24.09" within one year, full dates when the stretch crosses a year. */
function periodLabel(a: string, b: string) {
  const [from, to] = [formatDate(a), formatDate(b)];
  return a.slice(0, 4) === b.slice(0, 4) ? `${from.slice(0, 5)} – ${to.slice(0, 5)}` : `${from} – ${to}`;
}
