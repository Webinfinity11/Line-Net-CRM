"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const themes = [
  { value: "system", label: "სისტემის", icon: Monitor },
  { value: "light", label: "ღია", icon: Sun },
  { value: "dark", label: "მუქი", icon: Moon },
] as const;

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>გარეგნობა</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={mounted ? theme : ""} onValueChange={setTheme} aria-label="გარეგნობა">
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value} disabled={!mounted} className="min-h-9">
            <Icon className="size-4" />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
