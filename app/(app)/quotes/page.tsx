import { ArrowUpRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import { SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { DataList, DataRow, EmptyState, tableCls } from "@/components/app/section-card";
import { NewQuoteDialog } from "@/components/app/quotes/quote-form-dialog";
import { QUOTE_STATUS_LABELS, QuoteStatusBadge, quoteTotals } from "@/components/app/quotes/status";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/i18n";
import { listClientsWithSites } from "@/lib/orders";
import { listQuotes, quoteCounts } from "@/lib/quotes";
import { requireUser } from "@/lib/session";
import { tbilisiToday } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "შეთავაზებები" };

const STATUSES: { key: QuoteStatus; tint: string }[] = [
  { key: "draft", tint: "#eef1f5" },
  { key: "sent", tint: "#eef2fb" },
  { key: "accepted", tint: "#eaf4ee" },
  { key: "declined", tint: "#faeeee" },
];

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q ? sp.q : undefined;
  const statusParam = typeof sp.status === "string" ? sp.status : undefined;
  const status = STATUSES.some((s) => s.key === statusParam) ? (statusParam as QuoteStatus) : undefined;

  const [rows, counts, clientRows] = await Promise.all([listQuotes({ q, status }), quoteCounts(), listClientsWithSites()]);
  const clients = clientRows.map((c) => ({ id: c.id, name: c.name, sites: c.sites.map((s) => ({ id: s.id, name: s.name })) }));
  const today = tbilisiToday();

  const href = (s?: QuoteStatus) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/quotes?${qs}` : "/quotes";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="შეთავაზებები"
        subtitle={`${counts.open} ღია · ${counts.accepted} მიღებული. მიღებული შეთავაზება ერთი ღილაკით ხდება შეკვეთა.`}
        actions={<NewQuoteDialog clients={clients} />}
      />

      <div className="ln-enter grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const active = status === s.key;
          return (
            <Link
              key={s.key}
              href={active ? href(undefined) : href(s.key)}
              aria-current={active ? "page" : undefined}
              title={active ? "ფილტრის მოხსნა" : `ფილტრი: ${QUOTE_STATUS_LABELS[s.key]}`}
              className={cn("ln-card ln-card-link overflow-hidden", active && "ring-2 ring-[#3457d5]")}
            >
              <div className="px-3 py-1.5 text-[11.5px] font-medium text-[#17212b] sm:px-4 sm:py-2 sm:text-[12px]" style={{ background: s.tint }}>
                {QUOTE_STATUS_LABELS[s.key]}
              </div>
              <div className="flex items-baseline justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="tabular font-heading text-[24px] font-semibold leading-none sm:text-[28px]">{counts[s.key]}</span>
                {active ? <span className="text-[11px] font-medium text-[#3457d5]">ფილტრი ჩართულია</span> : null}
              </div>
            </Link>
          );
        })}
      </div>

      <form method="get" className="ln-card flex flex-wrap items-center gap-2 p-3">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ძებნა ნომრით ან სათაურით"
            className="h-11 w-full rounded-full border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-3 text-[16px] outline-none transition focus:border-[#a5b5ed] focus:bg-white sm:h-9 sm:text-[13px]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-11 sm:h-9">
          ძებნა
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          message={
            q || status
              ? "ამ ფილტრში შეთავაზება ვერ მოიძებნა."
              : "შეთავაზება არის კლიენტისთვის გაგზავნილი ფასი: პოზიციები კატალოგიდან, ჯამი და ვადა. მიღების შემდეგ ერთი ღილაკით იქცევა შეკვეთად."
          }
          action={q || status ? undefined : <NewQuoteDialog clients={clients} />}
        />
      ) : (
        <div className={tableCls.wrap}>
          <DataList className="px-4 py-2">
            {rows.map((row) => {
              const { total, vatRate } = quoteTotals(row.items, row.vatPercent);
              const expired = row.validUntil && row.validUntil < today && (row.status === "draft" || row.status === "sent");
              return (
                <DataRow
                  key={row.id}
                  href={`/quotes/${row.id}`}
                  title={row.title}
                  meta={
                    <>
                      <div>
                        {row.number} · {row.client?.name ?? "კლიენტის გარეშე"}
                        {row.site ? ` · ${row.site.name}` : ""}
                      </div>
                      <div className={cn(expired && "font-medium text-[#b13f32]")}>
                        {row.validUntil ? `ძალაშია ${formatDate(row.validUntil)}-მდე` : "ვადის გარეშე"}
                      </div>
                      <QuoteStatusBadge status={row.status} />
                    </>
                  }
                  right={
                    <>
                      <span className="tabular font-heading text-[15px] font-semibold">{formatMoney(total)}</span>
                      {vatRate > 0 ? <div className="text-[11px] text-muted-foreground">დღგ-ით</div> : null}
                    </>
                  }
                />
              );
            })}
          </DataList>

          <div className={`hidden sm:block ${tableCls.scroll}`}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>ნომერი</th>
                  <th className={tableCls.th}>სათაური</th>
                  <th className={tableCls.th}>სისტემა</th>
                  <th className={tableCls.thRight}>ჯამი</th>
                  <th className={tableCls.th}>ძალაშია</th>
                  <th className={tableCls.th}>სტატუსი</th>
                  <th className={tableCls.th}>შეკვეთა</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { total, vatRate } = quoteTotals(row.items, row.vatPercent);
                  const expired = row.validUntil && row.validUntil < today && (row.status === "draft" || row.status === "sent");
                  return (
                    <tr key={row.id} className={tableCls.row}>
                      <td className={`${tableCls.td} font-mono text-[11.5px] whitespace-nowrap text-muted-foreground`}>
                        <Link href={`/quotes/${row.id}`} className="block">
                          {row.number}
                        </Link>
                      </td>
                      <td className={`${tableCls.td} max-w-[320px]`}>
                        <Link href={`/quotes/${row.id}`} className="block">
                          <div className="truncate font-medium">{row.title}</div>
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {row.client?.name ?? "კლიენტის გარეშე"}
                            {row.site ? ` · ${row.site.name}` : ""}
                          </div>
                        </Link>
                      </td>
                      <td className={tableCls.td}>
                        <SystemBadge system={row.systemType} />
                      </td>
                      <td className={`${tableCls.tdRight} font-semibold`}>
                        {formatMoney(total)}
                        {vatRate > 0 ? <div className="text-[11px] font-normal text-muted-foreground">დღგ {vatRate}%</div> : null}
                      </td>
                      <td className={cn(tableCls.td, "whitespace-nowrap", expired && "font-semibold text-[#b13f32]")}>
                        {row.validUntil ? formatDate(row.validUntil) : "—"}
                      </td>
                      <td className={tableCls.td}>
                        <QuoteStatusBadge status={row.status} />
                      </td>
                      <td className={tableCls.td}>
                        {row.order ? (
                          <Link href={`/orders/${row.order.id}`} className="inline-flex items-center gap-1 text-[12px] text-[#3457d5] hover:underline">
                            {row.order.number} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
