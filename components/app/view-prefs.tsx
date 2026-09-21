"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ViewItem = { key: string; label: string; hint?: string };

/**
 * Lets each person decide which blocks of a screen they want to see. The choice is
 * theirs alone and lives in their browser, so it needs no table and no round trip.
 * Hiding is done with a stylesheet keyed on `data-view`, which keeps the markup of
 * the screens themselves server-rendered and untouched.
 */
export function ViewPrefs({ storageKey, items, label = "მორგება", attr = "data-view", mobileIcon = false }: { storageKey: string; items: ViewItem[]; label?: string; attr?: string; mobileIcon?: boolean }) {
  const [hidden, setHidden] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setHidden(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setHidden([]);
    }
  }, [storageKey]);

  function save(next: string[]) {
    setHidden(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // a blocked storage only costs the person their preference, never the screen
    }
  }

  const off = hidden ?? [];
  const toggle = (key: string) => save(off.includes(key) ? off.filter((k) => k !== key) : [...off, key]);
  const rules = off.map((k) => `[${attr}="${k}"]{display:none!important}`).join("");

  return (
    <>
      {off.length > 0 && <style>{rules}</style>}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={label} render={<Button variant="outline" size="sm" className={cn("h-10 sm:h-9 max-md:min-h-[44px]", mobileIcon && "max-md:size-11 max-md:shrink-0 max-md:p-0")} />}>
          <SlidersHorizontal className="size-4" />
          <span className={mobileIcon ? "max-md:hidden" : undefined}>{label}</span>
          {off.length > 0 && <span className={cn(mobileIcon && "max-md:hidden", "tabular ml-0.5 rounded-full bg-[#eef2ff] px-1.5 text-[11px] font-medium text-[#3457d5]")}>{items.length - off.length}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[260px] p-2">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium tracking-[0.04em] text-muted-foreground">რა გამოჩნდეს</div>
          <ul className="space-y-0.5">
            {items.map((it) => {
              const on = !off.includes(it.key);
              return (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => toggle(it.key)}
                    aria-pressed={on}
                    className={cn("flex max-md:min-h-[44px] w-full items-start gap-2.5 rounded-[10px] px-2 py-2 text-left text-[13px] transition-colors", on ? "hover:bg-[#f1f4f9]" : "text-muted-foreground hover:bg-[#f8faff]")}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-150",
                        on ? "bg-[#3457d5]" : "bg-[#dbe1ec]",
                      )}
                    >
                      <span className={cn("size-[14px] rounded-full bg-white transition-transform duration-150", on && "translate-x-[12px]")} />
                    </span>
                    <span className="min-w-0">
                      <span className="block">{it.label}</span>
                      {it.hint && <span className="block text-[11px] text-muted-foreground">{it.hint}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {off.length > 0 && (
            <button type="button" onClick={() => save([])} className="mt-1.5 flex max-md:min-h-[44px] w-full items-center gap-1.5 rounded-[10px] px-2 py-2 text-[12px] text-[#3457d5] transition-colors hover:bg-[#f1f4f9]">
              <RotateCcw className="size-3.5" /> ყველას დაბრუნება
            </button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
