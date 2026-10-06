"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toMtavruli } from "@/lib/mtavruli";

/** Recoverable data error state for app pages. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-[#f4e2d7] dark:border-[var(--ln-alert-line)] bg-card p-6 text-center" role="alert">
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-[#fff0ed] dark:bg-[var(--ln-alert-bg)] text-[#b13f32] dark:text-[var(--ln-alert)]">
        <TriangleAlert className="size-5 [stroke-width:1.7]" />
      </span>
      <h2 className="font-heading text-[18px]">{toMtavruli('მონაცემების ჩატვირთვა ვერ მოხერხდა')}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">სცადეთ თავიდან. თუ პრობლემა მეორდება, გადაუგზავნეთ ეს კოდი ადმინისტრატორს.</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">{error.digest}</p>}
      <Button className="mt-4" onClick={() => reset()}>
        <RotateCcw className="size-4" /> თავიდან ცდა
      </Button>
    </div>
  );
}
