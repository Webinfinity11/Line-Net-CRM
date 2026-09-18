"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Pick any day instead of stepping there with the arrows. The native picker is the
 * right tool on a phone, so the button only opens it; `showPicker` where the browser
 * has it, a plain focus everywhere else.
 */
// `basePath`/`param` rather than a callback: a function cannot cross from a server
// component into a client one.
export function DateJump({ value, basePath, param = "date", label = "თარიღის არჩევა" }: { value: string; basePath: string; param?: string; label?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  return (
    <span className="relative inline-flex">
      <Button
        variant="outline"
        size="icon-sm"
        className="h-10 w-10 md:h-8 md:w-8"
        aria-label={label}
        title={label}
        onClick={() => {
          const el = input.current;
          if (!el) return;
          if ("showPicker" in el) {
            try {
              (el as HTMLInputElement & { showPicker: () => void }).showPicker();
              return;
            } catch {
              // Safari refuses outside a user gesture it recognises; the focus below still works
            }
          }
          el.focus();
          el.click();
        }}
      >
        <CalendarDays className="size-4" />
      </Button>
      <input
        ref={input}
        type="date"
        defaultValue={value}
        aria-label={label}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
        onChange={(e) => e.target.value && router.push(`${basePath}?${param}=${e.target.value}`)}
      />
    </span>
  );
}
