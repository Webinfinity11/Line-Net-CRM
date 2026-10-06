import { monthOptions, parseMonth } from "@/lib/month-filter";
import { X } from "lucide-react";
import Link from "next/link";
import type { OrderPriority, OrderType } from "@/db/schema";
import { PRIORITY_LABELS, TYPE_LABELS, t } from "@/lib/i18n";
import { systemLabels } from "@/lib/systems";

type Sp = Record<string, string | string[] | undefined>;

/** Chips for every filter that is actually applied, each removable on its own. */
export async function FilterChips({ sp, users, clients }: { sp: Sp; users: { id: string; name: string }[]; clients: { id: number; name: string }[] }) {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") base.set(k, v);

  const hrefWithout = (k: string) => {
    const q = new URLSearchParams(base);
    q.delete(k);
    q.delete("page");
    const str = q.toString();
    return str ? `/orders?${str}` : "/orders";
  };

  const chips: { key: string; label: string }[] = [];
  const month = parseMonth(get("month"));
  if (month) chips.push({ key: "month", label: `თვე: ${monthOptions(month.from, month.from)[0].label}` });
  const q = get("q");
  if (q) chips.push({ key: "q", label: `${t.common.search}: ${q}` });
  const type = get("type");
  if (type) chips.push({ key: "type", label: `${t.order.type}: ${TYPE_LABELS[type as OrderType] ?? type}` });
  const system = get("system");
  if (system) chips.push({ key: "system", label: `${t.order.system}: ${(await systemLabels())[system] ?? system}` });
  const priority = get("priority");
  if (priority) chips.push({ key: "priority", label: `${t.order.priority}: ${PRIORITY_LABELS[priority as OrderPriority] ?? priority}` });
  const assignee = get("assignee");
  if (assignee) chips.push({ key: "assignee", label: `${t.order.assignees}: ${users.find((u) => u.id === assignee)?.name ?? assignee}` });
  const client = get("client");
  if (client) chips.push({ key: "client", label: `${t.order.client}: ${clients.find((c) => String(c.id) === client)?.name ?? client}` });
  if (get("overdue") === "1") chips.push({ key: "overdue", label: t.order.overdue });

  if (chips.length === 0) return null;
  const clearHref = get("view") === "kanban" ? "/orders?view=kanban" : "/orders";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="აქტიური ფილტრები">
      {chips.map((c) => (
        <Link
          key={c.key}
          href={hrefWithout(c.key)}
          className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-[#cde5e8] dark:border-primary bg-accent py-1 pl-2.5 pr-2 text-[11px] text-primary transition-colors hover:bg-[#dceef0] dark:hover:bg-accent"
        >
          <span className="truncate">{c.label}</span>
          <X className="size-3 shrink-0" aria-hidden />
          <span className="sr-only">ფილტრის მოხსნა</span>
        </Link>
      ))}
      {chips.length > 1 && (
        <Link href={clearHref} className="ln-link text-[11px]">
          ყველას გასუფთავება ({chips.length})
        </Link>
      )}
    </div>
  );
}
