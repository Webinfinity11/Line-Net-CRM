import type { PaymentStatus } from "@/db/schema";

/** Rounds to cents to avoid floating point drift in comparisons. */
export const cents = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);

export function computePaymentStatus(amount: number | string | null | undefined, paidTotal: number | string | null | undefined): PaymentStatus {
  const a = cents(amount);
  const p = cents(paidTotal);
  if (p <= 0) return "unpaid";
  if (a > 0 && p >= a) return "paid";
  if (a <= 0 && p > 0) return "paid";
  return "partial";
}

export function balance(amount: number | string | null | undefined, paidTotal: number | string | null | undefined): number {
  return Math.max(0, cents(amount) - cents(paidTotal)) / 100;
}

export type MaterialLike = { quantity: string | number; unitCost: string | number | null };

/**
 * Materials cost. `known` is false when nothing is recorded or any line has no price,
 * so callers can show "—" instead of a misleading 0.
 */
export function materialsCost(materials: MaterialLike[]): { cost: number; known: boolean; missingPrices: number } {
  if (materials.length === 0) return { cost: 0, known: false, missingPrices: 0 };
  let total = 0;
  let missing = 0;
  for (const m of materials) {
    if (m.unitCost === null || m.unitCost === undefined || m.unitCost === "") missing++;
    else total += Number(m.unitCost) * Number(m.quantity);
  }
  return { cost: Math.round(total * 100) / 100, known: missing === 0, missingPrices: missing };
}

/** Amount minus known materials cost. Null when the cost is unknown. */
export function marginAfterMaterials(amount: number | string | null | undefined, materials: MaterialLike[]): number | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const c = materialsCost(materials);
  if (!c.known) return null;
  return Math.round((Number(amount) - c.cost) * 100) / 100;
}

export const PAYMENT_METHODS: Record<string, string> = {
  transfer: "გადარიცხვა",
  cash: "ნაღდი",
  card: "ბარათი",
  migration: "გადატანილი",
  other: "სხვა",
};
