import { AlertTriangle } from "lucide-react";
import type { OrderPriority, OrderStatus, OrderType, PaymentStatus, SystemType } from "@/db/schema";
import {
  PAYMENT_COLORS,
  PAYMENT_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SYSTEM_COLORS,
  SYSTEM_LABELS,
  TYPE_LABELS,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-[3px] text-[11px] font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn(base, STATUS_COLORS[status], className)}>
      <i className="size-[5px] rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PAYMENT_DOT: Record<PaymentStatus, string> = { unpaid: "#b13f32", partial: "#96610b", paid: "#25815a" };

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground", className)}>
      <i className="size-[5px] shrink-0 rounded-full" style={{ background: PAYMENT_DOT[status] }} aria-hidden />
      {PAYMENT_LABELS[status]}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: OrderType; className?: string }) {
  return (
    <span
      className={cn(
        base,
        "bg-[#f1f4f9] text-[#5b6b7c] dark:bg-neutral-800 dark:text-neutral-300",
        className,
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function PriorityLabel({ priority, className }: { priority: OrderPriority; className?: string }) {
  // only urgent earns a colour; the rest stay quiet so the row reads calmly
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11.5px] whitespace-nowrap", PRIORITY_COLORS[priority], className)}>
      {priority === "urgent" && <AlertTriangle className="size-3 shrink-0" />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, "bg-rose-600 text-white", className)}>
      <AlertTriangle className="size-3" /> ვადაგადაცილებული
    </span>
  );
}

export function SystemBadge({ system, className }: { system: SystemType | null | undefined; className?: string }) {
  if (!system) return null;
  return <span className={cn(base, SYSTEM_COLORS[system], className)}>{SYSTEM_LABELS[system]}</span>;
}
