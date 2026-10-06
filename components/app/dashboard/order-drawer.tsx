"use client";

import { CalendarDays, Clock3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AssignForm } from "@/components/app/assign-form";
import { OverdueBadge, PriorityLabel, StatusBadge } from "@/components/app/badges";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TYPE_LABELS, formatDate } from "@/lib/i18n";
import { useSystemLabel } from "@/components/app/systems-provider";
import { JobIcon } from "./job-icon";
import type { BoardOrder, Executor } from "./types";

const CLOSED_FOR_ASSIGN = new Set(["done", "closed", "cancelled"]);

/**
 * Right-hand detail drawer for a board row: summary, assignment (one executor,
 * replaces the current list) and links to the full order page / schedule.
 */
export function OrderDrawer({ order, executors, normHours, today, onClose }: { order: BoardOrder | null; executors: Executor[]; normHours: number; today: string; onClose: () => void }) {
  const systemName = useSystemLabel(order?.systemType);
  const canAssign = order ? !CLOSED_FOR_ASSIGN.has(order.status) : false;

  return (
    <Sheet open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-5 sm:p-7 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px] [&>[data-slot=sheet-close]]:size-11">
        {order && (
          <div className="ln-panel-in min-w-0 space-y-6 [overflow-wrap:anywhere]">
            <div className="min-w-0">
              <div className="pr-10 text-[11px] leading-relaxed text-muted-foreground">
                {order.number}
                {order.client ? ` · ${order.client.name}` : ""}
                {order.site ? ` · ${order.site.name}` : ""}
              </div>
              <div className="mt-3 flex min-w-0 items-start gap-3 pr-10">
                <JobIcon system={order.systemType} className="mt-0.5 shrink-0" />
                <SheetTitle className="min-w-0 break-words font-heading text-[20px] font-bold leading-snug text-foreground">{order.title}</SheetTitle>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                {order.completedLabel && <span className="text-[12px] text-muted-foreground">დასრულდა: {order.completedLabel}</span>}
                <PriorityLabel priority={order.priority} />
                {order.overdue && <OverdueBadge />}
              </div>
            </div>

            <SheetDescription className="border-t border-border pt-6 text-[13px] leading-relaxed text-[#4a5e73] dark:text-[var(--ln-strong)]">
              {order.description || "აღწერა არ არის დამატებული."}
            </SheetDescription>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border pt-6 text-[13px] leading-relaxed sm:grid-cols-2 [&>div]:min-w-0">
              <div>
                <dt className="text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">ტიპი · კატეგორია</dt>
                <dd className="mt-1">
                  {TYPE_LABELS[order.type]}
                  {order.systemType ? ` · ${systemName}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">ვადა</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" /> {order.dueDate ? formatDate(order.dueDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">დაგეგმილი დრო</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Clock3 className="size-3.5 shrink-0 text-muted-foreground" /> {order.scheduledLabel ?? "დაუგეგმავი"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">მისამართი</dt>
                <dd className="mt-1 break-words">{order.site?.address ?? order.site?.name ?? "—"}</dd>
              </div>
            </dl>

            <div className="border-t border-border pt-6">
              <div className="mb-3 text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">შემსრულებლები</div>
              {order.assignees.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">ელოდება შემსრულებლის დანიშვნას</p>
              ) : (
                <ul className="space-y-3">
                  {order.assignees.map((a) => (
                    <li key={a.id} className="flex min-w-0 items-center gap-2 text-[13px]">
                      <UserAvatar name={a.name} image={a.image} size="xs" /> <span className="min-w-0 break-words">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canAssign && (
              <div className="border-t border-border pt-6">
                <div className="mb-4 text-[11px] font-medium text-[#4a5e73] dark:text-[var(--ln-strong)]">დანიშვნა და დრო</div>
                <AssignForm
                  orderId={order.id}
                  systemType={order.systemType}
                  executors={executors}
                  normHours={normHours}
                  defaultAssigneeId={order.assignees[0]?.id ?? null}
                  assignedIds={order.assignees.map(a => a.id)}
                  defaultDate={order.scheduledAt ? order.scheduledAt.slice(0, 10) : today}
                  defaultTime={order.timeLabel}
                  defaultMinutes={order.plannedMinutes}
                  onDone={onClose}
                />
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
              <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" render={<Link href={`/orders/${order.id}`} />}>
                <ExternalLink className="size-4" /> სრული გვერდი
              </Button>
              <Button variant="ghost" className="min-h-[44px] w-full sm:w-auto" render={<Link href="/schedule" />}>
                <CalendarDays className="size-4" /> განრიგი
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
