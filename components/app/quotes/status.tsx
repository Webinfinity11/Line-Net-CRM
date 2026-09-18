import type { QuoteStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "მონახაზი",
  sent: "გაგზავნილი",
  accepted: "მიღებული",
  declined: "უარყოფილი",
};

/** Muted chips in the same family as order statuses: colour marks state, nothing else. */
const CHIP: Record<QuoteStatus, string> = {
  draft: "bg-[#eef1f5] text-[#65717f]",
  sent: "bg-[#f8faff] text-[#3d5a8a]",
  accepted: "bg-[#eaf4ee] text-[#35735a]",
  declined: "bg-[#faeeee] text-[#96504e]",
};

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-[3px] text-[11px] font-medium whitespace-nowrap", CHIP[status], className)}>
      <i className="size-[5px] rounded-full bg-current" aria-hidden />
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}

/** Subtotal, VAT and the grand total from the stored lines. */
export function quoteTotals(items: { quantity: string; unitPrice: string }[], vatPercent: string | number) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
  const vatRate = Number(vatPercent) || 0;
  const vat = (subtotal * vatRate) / 100;
  return { subtotal, vatRate, vat, total: subtotal + vat };
}
