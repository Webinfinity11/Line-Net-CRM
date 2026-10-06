"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/actions/orders";
import type { OrderStatus } from "@/db/schema";
import { KANBAN_STATUSES, STATUS_HEX, STATUS_LABELS, formatDate, formatMoney } from "@/lib/i18n";
import type { OrderListItem } from "@/lib/orders";
import { isOverdue } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { OverdueBadge, PriorityLabel, TypeBadge } from "./badges";
import { AvatarStack } from "./user-avatar";

export function Kanban({ orders }: { orders: OrderListItem[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<OrderStatus | null>(null);
  const [items, move] = useOptimistic(orders, (state, { id, status }: { id: number; status: OrderStatus }) =>
    state.map((o) => (o.id === id ? { ...o, status } : o)),
  );

  function drop(status: OrderStatus) {
    if (dragId === null) return;
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    const current = items.find((o) => o.id === id);
    if (!current || current.status === status) return;
    start(async () => {
      move({ id, status });
      const res = await setStatus(id, status);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_STATUSES.map((status) => {
        const col = items.filter((o) => o.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== status) setOverCol(status);
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => drop(status)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-[#f1f4f9]/70 transition-colors dark:bg-neutral-900",
              overCol === status && dragId !== null && "border-[#3457d5] bg-[#eef2ff] dark:bg-blue-950/30",
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="size-2.5 rounded-full" style={{ background: STATUS_HEX[status] }} />
              <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground dark:bg-neutral-800">{col.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
              {col.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  draggable
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  className={cn(
                    "ln-card-link block cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:bg-neutral-800",
                    dragId === o.id && "opacity-50",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{o.number}</span>
                    <TypeBadge type={o.type} className="px-1.5 py-0 text-[10px]" />
                  </div>
                  <div className="line-clamp-2 text-sm font-medium leading-snug">{o.title}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{o.client?.name ?? o.emailFrom ?? "—"}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <AvatarStack users={o.assignees.map((a) => a.user)} />
                    <div className="flex min-w-0 flex-col items-end gap-1.5 text-[11px]">
                      <PriorityLabel priority={o.priority} />
                      {isOverdue(o) && <OverdueBadge />}
                      {o.dueDate && <span className="text-muted-foreground">{formatDate(o.dueDate)}</span>}
                    </div>
                  </div>
                  {o.amount && <div className="mt-1.5 text-right text-xs font-medium">{formatMoney(o.amount)}</div>}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
