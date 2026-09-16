import Link from "next/link";
import { PriorityLabel, SystemBadge } from "@/components/app/badges";
import { QuickPlanDialog } from "@/components/app/quick-plan-dialog";
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
  currentAssigneeId: string | null;
};

/** Left column of the dispatch board: jobs waiting for an executor or a time slot. */
export function Queue({ items, day, users }: { items: QueueItem[]; day: string; users: { id: string; name: string }[] }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed border-[#e6ebf2] px-3 py-8 text-center text-xs text-muted-foreground">რიგი ცარიელია</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((o) => (
        <div key={o.id} className="rounded-md border border-[#e6ebf2] bg-white p-[13px] text-xs transition-[border-color,box-shadow] duration-150 hover:border-[#c9d3e3] hover:shadow-[0_4px_14px_rgba(38,57,104,0.06)]">
          <Link href={`/orders/${o.id}`} className="block text-[13px] font-medium leading-snug text-foreground hover:text-[#3457d5]">
            {o.title}
          </Link>
          <div className="mt-1 leading-relaxed text-muted-foreground">
            {o.number} · {o.client ?? "—"} · ვადა {o.dueDate ? formatDate(o.dueDate) : "—"}
            {o.scheduled ? " · დღეს, დაუნიშნავი" : ""}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SystemBadge system={o.systemType} />
            <PriorityLabel priority={o.priority} className="text-[11px]" />
            <div className="ml-auto">
              <QuickPlanDialog orderId={o.id} title={o.title} defaultDate={day} users={users} currentAssigneeId={o.currentAssigneeId} label="დანიშვნა" variant="secondary" className="h-10 md:h-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
