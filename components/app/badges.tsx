import { AlertTriangle } from "lucide-react";
import type { OrderPriority, OrderStatus, OrderType, PaymentStatus } from "@/db/schema";
import {
  PAYMENT_COLORS,
  PAYMENT_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <span className={cn(base, STATUS_COLORS[status], className)}>{STATUS_LABELS[status]}</span>;
}

export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <span className={cn(base, PAYMENT_COLORS[status], className)}>{PAYMENT_LABELS[status]}</span>;
}

export function TypeBadge({ type, className }: { type: OrderType; className?: string }) {
  return (
    <span
      className={cn(
        base,
        type === "project"
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800"
          : "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800",
        className,
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function PriorityLabel({ priority, className }: { priority: OrderPriority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", PRIORITY_COLORS[priority], className)}>
      {priority === "urgent" && <AlertTriangle className="size-3" />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, "bg-red-600 text-white", className)}>
      <AlertTriangle className="size-3" /> ვადაგადაცილებული
    </span>
  );
}
