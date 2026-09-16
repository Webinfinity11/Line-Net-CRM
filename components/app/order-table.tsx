import Link from "next/link";
import { formatDate, formatMoney, t } from "@/lib/i18n";
import type { OrderListItem } from "@/lib/orders";
import { isOverdue } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { OverdueBadge, PaymentBadge, PriorityLabel, StatusBadge, TypeBadge } from "./badges";
import { AvatarStack } from "./user-avatar";

export function OrderTable({ orders, compact = false, showMoney = true }: { orders: OrderListItem[]; compact?: boolean; showMoney?: boolean }) {
  if (orders.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{t.common.noResults}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{t.order.number}</th>
            <th className="px-3 py-2.5 font-medium">{t.order.title}</th>
            <th className="px-3 py-2.5 font-medium">{t.order.client}</th>
            {!compact && <th className="px-3 py-2.5 font-medium">{t.order.type}</th>}
            <th className="px-3 py-2.5 font-medium">{t.order.priority}</th>
            <th className="px-3 py-2.5 font-medium">{t.order.assignees}</th>
            <th className="px-3 py-2.5 font-medium">{t.order.status}</th>
            <th className="px-3 py-2.5 font-medium">{t.order.dueDate}</th>
            {showMoney && !compact && <th className="px-3 py-2.5 text-right font-medium">{t.order.amount}</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const overdue = isOverdue(o);
            return (
              <tr key={o.id} className="group border-b last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  <Link href={`/orders/${o.id}`} className="block">
                    {o.number}
                  </Link>
                </td>
                <td className="max-w-[320px] px-3 py-2.5">
                  <Link href={`/orders/${o.id}`} className="block">
                    <div className="truncate font-medium group-hover:text-sky-700">{o.title}</div>
                    {compact && (
                      <div className="mt-0.5">
                        <TypeBadge type={o.type} className="px-1.5 py-0 text-[10px]" />
                      </div>
                    )}
                  </Link>
                </td>
                <td className="max-w-[200px] px-3 py-2.5">
                  <div className="truncate">{o.client?.name ?? <span className="text-muted-foreground">—</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.site?.name ?? o.address ?? ""}</div>
                </td>
                {!compact && (
                  <td className="px-3 py-2.5">
                    <TypeBadge type={o.type} />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <PriorityLabel priority={o.priority} />
                </td>
                <td className="px-3 py-2.5">
                  <AvatarStack users={o.assignees.map((a) => a.user)} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={o.status} />
                    {overdue && !compact && <OverdueBadge />}
                  </div>
                </td>
                <td className={cn("px-3 py-2.5 whitespace-nowrap", overdue && "font-semibold text-rose-600")}>{formatDate(o.dueDate)}</td>
                {showMoney && !compact && (
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div>{formatMoney(o.amount)}</div>
                    {o.amount && <PaymentBadge status={o.paymentStatus} className="px-1.5 py-0 text-[10px]" />}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
