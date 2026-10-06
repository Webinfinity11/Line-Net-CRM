import Link from "next/link";
import { PriorityLabel, SystemBadge } from "@/components/app/badges";
import { AssignDialog, type ExecutorOption } from "@/components/app/assign-form";
import type { OrderPriority, SystemType } from "@/db/schema";
import { formatDate } from "@/lib/i18n";

export type QueueItem = {
  id: number;
  number: string;
  title: string;
  client: string | null;
  dueDate: string | null;
  priority: OrderPriority;
  systemType: SystemType | null;
  scheduled: boolean;
  assignedIds: string[];
  currentAssigneeId: string | null;
};

/** Left column of the dispatch board: jobs waiting for an executor or a time slot. */
export function Queue({ items, day, executors, normHours }: { items: QueueItem[]; day: string; executors: ExecutorOption[]; normHours: number }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">რიგი ცარიელია</div>;
  }
  return (
    // a divided list, not boxes: the queue already sits inside a card
    <div className="divide-y divide-[#eef1f6] dark:divide-border">
      {items.map((o) => (
        <div key={o.id} className="py-3 text-xs first:pt-0 last:pb-0">
          <Link href={`/orders/${o.id}`} className="ln-link block text-[13px] font-medium leading-snug">
            {o.title}
          </Link>
          <div className="mt-1 leading-relaxed text-muted-foreground">
            {o.number} · {o.client ?? "—"}
            {o.dueDate ? ` · ვადა ${formatDate(o.dueDate)}` : ""}
            {o.scheduled ? " · დღეს, დაუნიშნავი" : ""}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SystemBadge system={o.systemType} />
            <PriorityLabel priority={o.priority} />
            <div className="ml-auto">
              <AssignDialog orderId={o.id} title={o.title} systemType={o.systemType} executors={executors} normHours={normHours} defaultAssigneeId={o.currentAssigneeId} assignedIds={o.assignedIds} defaultDate={day} defaultTime={null} className="h-10 md:h-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
