"use client";

import { CalendarDays, Clock3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AssignForm } from "@/components/app/assign-form";
import { StatusBadge } from "@/components/app/badges";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PRIORITY_COLORS, PRIORITY_LABELS, TYPE_LABELS, formatDate } from "@/lib/i18n";
import { useSystemLabel } from "@/components/app/systems-provider";
import { cn } from "@/lib/utils";
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
      <SheetContent side="right" className="w-full overflow-y-auto p-6 data-[side=right]:sm:max-w-[440px]">
        {order && (
          <div className="ln-panel-in space-y-5">
            <div className="pr-8">
              <div className="text-[11px] text-muted-foreground">
                {order.number}
                {order.client ? ` · ${order.client.name}` : ""}
                {order.site ? ` · ${order.site.name}` : ""}
              </div>
              <div className="mt-2 flex items-start gap-3">
                <JobIcon system={order.systemType} className="mt-0.5" />
                <SheetTitle className="font-heading text-lg font-medium leading-snug text-foreground">{order.title}</SheetTitle>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <span className={cn("text-[11px]", PRIORITY_COLORS[order.priority])}>{PRIORITY_LABELS[order.priority]}</span>
                {order.overdue && <span className="text-[11px] font-medium text-[#b13f32]">ვადაგადაცილებული</span>}
              </div>
            </div>

            <SheetDescription className="text-[13px] leading-relaxed text-[#4a5e73]">
              {order.description || "აღწერა არ არის დამატებული."}
            </SheetDescription>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border bg-[#f8faff] p-3 text-[12px]">
              <div>
                <dt className="text-[11px] text-muted-foreground">ტიპი · კატეგორია</dt>
                <dd className="mt-0.5">
                  {TYPE_LABELS[order.type]}
                  {order.systemType ? ` · ${systemName}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">ვადა</dt>
                <dd className={cn("mt-0.5 flex items-center gap-1", order.overdue && "font-medium text-[#b13f32]")}>
                  <CalendarDays className="size-3.5 text-muted-foreground" /> {order.dueDate ? formatDate(order.dueDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">დაგეგმილი დრო</dt>
                <dd className="mt-0.5 flex items-center gap-1">
                  <Clock3 className="size-3.5 text-muted-foreground" /> {order.scheduledLabel ?? "დაუგეგმავი"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">მისამართი</dt>
                <dd className="mt-0.5 truncate">{order.site?.address ?? order.site?.name ?? "—"}</dd>
              </div>
            </dl>

            <div>
              <div className="mb-2 text-[11px] text-muted-foreground">შემსრულებლები</div>
              {order.assignees.length === 0 ? (
                <p className="text-[12px] text-[#a84630]">ელოდება შემსრულებლის დანიშვნას</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {order.assignees.map((a) => (
                    <li key={a.id} className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[12px]">
                      <UserAvatar name={a.name} image={a.image} size="xs" /> {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canAssign && (
              <div className="border-t border-border pt-4">
                <div className="mb-2 text-[11px] text-muted-foreground">დანიშვნა და დრო</div>
                <AssignForm
                  orderId={order.id}
                  systemType={order.systemType}
                  executors={executors}
                  normHours={normHours}
                  defaultAssigneeId={order.assignees[0]?.id ?? null}
                  defaultDate={order.scheduledAt ? order.scheduledAt.slice(0, 10) : today}
                  defaultTime={order.timeLabel}
                  defaultMinutes={order.plannedMinutes}
                  onDone={onClose}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" render={<Link href={`/orders/${order.id}`} />}>
                <ExternalLink className="size-4" /> სრული გვერდი
              </Button>
              <Button variant="ghost" render={<Link href="/schedule" />}>
                <CalendarDays className="size-4" /> განრიგი
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
