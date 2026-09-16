import { Bell } from "lucide-react";
import Link from "next/link";
import { MarkAllReadButton } from "@/components/app/mark-all-read";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, t } from "@/lib/i18n";
import { getUnreadCount, listNotifications } from "@/lib/notify";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "შეტყობინებები" };

export default async function NotificationsPage() {
  const me = await requireUser();
  const [items, unread] = await Promise.all([listNotifications(me.id, 200), getUnreadCount(me.id)]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.nav2.notifications} subtitle={unread ? `${unread} წაუკითხავი` : "ყველა წაკითხულია"} actions={unread > 0 ? <MarkAllReadButton /> : null} />
      {items.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center text-sm text-muted-foreground dark:bg-neutral-900">
          <Bell className="mx-auto mb-2 size-8 text-neutral-300" />
          შეტყობინებები არ არის
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((n) => {
            const inner = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="shrink-0 text-xs text-muted-foreground">{formatDate(n.createdAt, true)}</div>
                </div>
                {n.body && <div className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">{n.body}</div>}
                {n.order && (
                  <div className="mt-1 text-xs text-blue-700">
                    {n.order.number} · {n.order.title}
                  </div>
                )}
              </>
            );
            const cls = cn("block rounded-lg border bg-white p-3 dark:bg-neutral-900", !n.readAt && "border-blue-300 bg-blue-50/60 dark:bg-blue-950/20");
            return (
              <li key={n.id}>
                {n.orderId ? (
                  <Link href={`/orders/${n.orderId}`} className={cn(cls, "hover:shadow-sm")}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
