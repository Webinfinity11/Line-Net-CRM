import { Bell, CalendarClock, CircleCheck, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { MarkAllReadButton } from "@/components/app/mark-all-read";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/section-card";
import { formatDate, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { getUnreadCount, listNotifications } from "@/lib/notify";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "შეტყობინებები" };

/** Only the types notifyUsers actually sends; anything else falls back to the bell. */
const ICONS: Record<string, typeof Bell> = {
  assigned: UserPlus,
  done: CircleCheck,
  email: Mail,
  schedule: CalendarClock,
};

export default async function NotificationsPage() {
  const me = await requireUser();
  const [items, unread] = await Promise.all([listNotifications(me.id, 200), getUnreadCount(me.id)]);
  const groups = [
    { key: "unread", label: "წაუკითხავი", rows: items.filter((n) => !n.readAt) },
    { key: "read", label: "წაკითხული", rows: items.filter((n) => n.readAt) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={t.nav2.notifications}
        subtitle={unread ? `${unread} წაუკითხავი` : "ყველა წაკითხულია"}
        actions={unread > 0 ? <MarkAllReadButton /> : null}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          message="შეტყობინებები არ არის. აქ გამოჩნდება დანიშვნები, ჩაბარებული სამუშაო და ფოსტიდან შემოსული მოთხოვნები."
          className="ln-card border-transparent py-16"
        />
      ) : (
        groups.map((g, gi) => (
          <section key={g.key} className={cn("space-y-2", gi === 0 ? "ln-enter" : "ln-enter ln-enter-2")} aria-label={g.label}>
            <h2 className="px-1 font-heading text-[12px] font-semibold text-muted-foreground">
              {toMtavruli(g.label)} · {g.rows.length}
            </h2>
            <ul className="space-y-1.5">
              {g.rows.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const inner = (
                  <>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", n.readAt ? "bg-[#f1f4f9] text-[#566b7d]" : "bg-[#edf2ff] text-[#3457d5]")}>
                      <Icon className="size-4 [stroke-width:1.7]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-[13px] font-medium">{n.title}</span>
                        <span className="tabular shrink-0 text-[11px] text-muted-foreground">{formatDate(n.createdAt, true)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 block text-[12.5px] text-[#566b7d]">{n.body}</span>}
                      {n.order && (
                        <span className="mt-1 block text-[11px] text-[#3457d5]">
                          {n.order.number} · {n.order.title}
                        </span>
                      )}
                    </span>
                  </>
                );
                const cls = cn("ln-card flex items-start gap-3 p-4", !n.readAt && "ring-1 ring-[#dbe3fd]");
                return (
                  <li key={n.id}>
                    {n.orderId ? (
                      <Link href={`/orders/${n.orderId}`} className={cn(cls, "ln-card-link")}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
