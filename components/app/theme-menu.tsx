"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", label: "ღია", icon: Sun },
  { value: "dark", label: "მუქი", icon: Moon },
  { value: "system", label: "სისტემის", icon: Monitor },
] as const;

/** One compact row at the foot of the profile menu: the label, then three icon toggles. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 max-md:flex-col max-md:items-stretch">
      <span className="text-xs text-muted-foreground">გარეგნობა</span>
      <div role="radiogroup" aria-label="გარეგნობა" className="flex gap-0.5 rounded-lg bg-muted p-0.5">
        {themes.map(({ value, label, icon: Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              disabled={!mounted}
              onClick={() => setTheme(value)}
              className={cn(
                "grid size-8 place-items-center rounded-md transition-colors max-md:h-11 max-md:w-auto max-md:flex-1 focus-visible:outline-2 focus-visible:outline-ring",
                active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
