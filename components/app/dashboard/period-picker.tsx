"use client";

import { CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Any stretch of days, for when the three presets are not the question being asked. */
export function PeriodPicker({ from, to, active }: { from?: string; to?: string; active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(from ?? "");
  const [b, setB] = useState(to ?? "");
  const valid = a && b && a <= b;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9", active && "border-[#a5b5ed] bg-[#eef2ff] text-[#3457d5]")}
          />
        }
      >
        <CalendarRange className="size-4" />
        {active && a && b ? `${a.slice(5)} – ${b.slice(5)}` : "პერიოდი"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px] p-3">
        <div className="mb-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">აირჩიეთ შუალედი</div>
        <div className="grid gap-2">
          <label className="grid gap-1 text-[11.5px] text-muted-foreground">
            დაწყება
            <input type="date" value={a} onChange={(e) => setA(e.target.value)} className="h-10 rounded-[10px] border border-[#dbe1ec] px-2 text-[13px] text-foreground outline-none focus:border-[#7f97e6]" />
          </label>
          <label className="grid gap-1 text-[11.5px] text-muted-foreground">
            დასრულება
            <input type="date" value={b} onChange={(e) => setB(e.target.value)} className="h-10 rounded-[10px] border border-[#dbe1ec] px-2 text-[13px] text-foreground outline-none focus:border-[#7f97e6]" />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="h-9 flex-1"
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
              className="h-9"
              onClick={() => {
                setOpen(false);
                router.push("/?range=week");
              }}
            >
              გასუფთავება
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
