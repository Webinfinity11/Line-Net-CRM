import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { OverdueBadge, PriorityLabel, StatusBadge, TypeBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { formatDate, t } from "@/lib/i18n";
import { isOverdue, listOrders, type OrderListItem } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "ჩემი შეკვეთები" };

function Group({ title, items, meId }: { title: string; items: OrderListItem[]; meId: string }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {title} · {items.length}
      </h2>
      {items.map((o) => {
        const unseen = o.assignees.some((a) => a.userId === meId && !a.seenAt);
        const overdue = isOverdue(o);
        return (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className={cn(
              "block rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-neutral-900",
              unseen && "border-sky-400 ring-2 ring-sky-100 dark:ring-sky-900",
            )}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
              <StatusBadge status={o.status} />
              <TypeBadge type={o.type} />
              {overdue && <OverdueBadge />}
              {unseen && <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-medium text-white">ახალი</span>}
            </div>
            <div className="text-base font-medium leading-snug">{o.title}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {o.client && <span>{o.client.name}</span>}
              {(o.address || o.site?.address) && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {o.address ?? o.site?.address}
                </span>
              )}
              {o.dueDate && (
                <span className={cn("flex items-center gap-1", overdue && "font-semibold text-rose-600")}>
                  <CalendarDays className="size-3" /> {formatDate(o.dueDate)}
                </span>
              )}
              <PriorityLabel priority={o.priority} />
            </div>
          </Link>
        );
      })}
    </section>
  );
}

export default async function MyOrdersPage() {
  const me = await requireUser();
  const all = await listOrders({ mine: me.id, status: "all", inbox: false }, { limit: 300 });
  const active = all.filter((o) => o.status === "assigned" || o.status === "in_progress" || o.status === "new");
  const done = all.filter((o) => o.status === "done");
  const closed = all.filter((o) => o.status === "closed" || o.status === "cancelled").slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t.nav.my} subtitle={`${active.length} აქტიური შეკვეთა`} />
      {all.length === 0 && (
        <div className="rounded-xl border bg-white py-16 text-center text-sm text-muted-foreground dark:bg-neutral-900">დანიშნული შეკვეთები არ გაქვთ</div>
      )}
      <Group title="აქტიური" items={active} meId={me.id} />
      <Group title="შესრულებული, ელოდება დახურვას" items={done} meId={me.id} />
      <Group title="დახურული" items={closed} meId={me.id} />
    </div>
  );
}
