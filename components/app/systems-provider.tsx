"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SystemType } from "@/db/schema";
import { SYSTEM_LABELS, SYSTEM_ORDER } from "@/lib/i18n";

export type SystemOption = { key: SystemType; name: string; color: string | null; sort: number; active: boolean };

const FALLBACK: SystemOption[] = SYSTEM_ORDER.map((key, i) => ({ key, name: SYSTEM_LABELS[key], color: null, sort: (i + 1) * 10, active: true }));

const Ctx = createContext<SystemOption[]>(FALLBACK);

/** Mounted once in the app layout so every picker and badge reads the admin's list. */
export function SystemsProvider({ systems, children }: { systems: SystemOption[]; children: ReactNode }) {
  return <Ctx.Provider value={systems.length ? systems : FALLBACK}>{children}</Ctx.Provider>;
}

/** Every system, including the hidden ones (an existing order may still use one). */
export function useSystems() {
  return useContext(Ctx);
}

/** Only what should appear in pickers. */
export function useActiveSystems() {
  return useContext(Ctx).filter((s) => s.active);
}

export function useSystemLabel(key: SystemType | null | undefined) {
  const all = useContext(Ctx);
  if (!key) return null;
  return all.find((s) => s.key === key)?.name ?? SYSTEM_LABELS[key] ?? key;
}
