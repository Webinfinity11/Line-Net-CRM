import { sql } from "drizzle-orm";
import { Building2, Download, Plus, Search } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/actions/clients";
import { ClientFields } from "@/components/app/client-forms";
import { FormDialog } from "@/components/app/form-dialog";
import { ImportClientsDialog } from "@/components/app/import-clients-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DataList, DataRow, EmptyState, tableCls } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clients, orders, sites } from "@/db/schema";
import { t } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "კლიენტები" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      idCode: clients.idCode,
      contactName: clients.contactName,
      phone: clients.phone,
      siteCount: sql<number>`(select count(*) from ${sites} where ${sites.clientId} = ${clients.id})`.mapWith(Number),
      orderCount: sql<number>`(select count(*) from ${orders} where ${orders.clientId} = ${clients.id})`.mapWith(Number),
      activeCount: sql<number>`(select count(*) from ${orders} where ${orders.clientId} = ${clients.id} and ${orders.status} in ('new','assigned','in_progress'))`.mapWith(Number),
    })
    .from(clients)
    .where(q ? sql`${clients.name} ilike ${"%" + q + "%"} or ${clients.contactName} ilike ${"%" + q + "%"} or ${clients.idCode} ilike ${"%" + q + "%"}` : undefined)
    .orderBy(clients.name);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav.clients}
        subtitle={q ? `„${q}“ · ნაპოვნია ${rows.length}` : `${rows.length} კლიენტი`}
        actions={
          <div className="flex flex-wrap items-center gap-2 max-md:[&_button]:h-11 max-md:[&_a]:h-11">
            <ImportClientsDialog />
            <Button render={<a href="/api/export?type=clients-list" />} variant="outline" size="sm" className="h-10 sm:h-8">
              <Download className="size-4" /> Excel
            </Button>
            <FormDialog
              trigger={<Button className="h-10 sm:h-9" />}
              triggerLabel={
                <>
                  <Plus className="size-4" /> ახალი კლიენტი
                </>
              }
              title="ახალი კლიენტი"
              action={createClient}
              submitLabel={t.common.create}
            >
              <ClientFields withSites />
            </FormDialog>
          </div>
        }
      />

      <form method="get" className="ln-enter ln-card flex flex-wrap items-center gap-2 p-3 sm:gap-3">
        <div className="relative w-full min-w-[200px] flex-1 sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground [stroke-width:1.7]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ძებნა: კომპანია, ს/კ, საკონტაქტო პირი"
            className="h-11 w-full rounded-full border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-4 text-[16px] outline-none transition focus:border-[#7f97e6] focus:bg-white sm:h-9 sm:text-[13px]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-11 flex-1 md:h-8 md:flex-none">
          ძებნა
        </Button>
        {q && (
          <Button render={<Link href="/clients" />} variant="ghost" size="sm" className="h-11 flex-1 md:h-8 md:flex-none">
            გასუფთავება
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          message={q ? "ამ ძებნაზე კლიენტი ვერ მოიძებნა." : "კლიენტები ჯერ არ არის. დაამატეთ პირველი კომპანია, მერე მის ობიექტებს დაამატებთ."}
          className="ln-card border-transparent py-16"
        />
      ) : (
        <div className={cn(tableCls.wrap, "ln-enter ln-enter-2")}>
          <DataList className="px-4 py-2 sm:block md:hidden">
            {rows.map((c) => (
              <DataRow
                key={c.id}
                href={`/clients/${c.id}`}
                title={c.name}
                meta={
                  <>
                    <div>{[c.idCode && `ს/კ ${c.idCode}`, c.phone].filter(Boolean).join(" · ") || "—"}</div>
                    <div>
                      {c.siteCount} ობიექტი · {c.orderCount} შეკვეთა
                    </div>
                  </>
                }
                right={c.activeCount > 0 ? <Chip tone="accent">{c.activeCount} აქტიური</Chip> : <span className="text-muted-foreground">—</span>}
              />
            ))}
          </DataList>
          <div className={cn(tableCls.scroll, "hidden md:block")}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>კომპანია</th>
                  <th className={cn(tableCls.th, "hidden md:table-cell")}>ს/კ</th>
                  <th className={cn(tableCls.th, "hidden lg:table-cell")}>საკონტაქტო</th>
                  <th className={cn(tableCls.thRight, "hidden sm:table-cell")}>ობიექტი</th>
                  <th className={cn(tableCls.thRight, "hidden sm:table-cell")}>შეკვეთა</th>
                  <th className={tableCls.thRight}>აქტიური</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <Link href={`/clients/${c.id}`} className="block">
                        <span className="block font-medium text-foreground hover:text-[#3457d5]">{c.name}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground md:hidden">
                          {[c.idCode, c.phone].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </Link>
                    </td>
                    <td className={cn(tableCls.td, "hidden font-mono text-[11px] text-muted-foreground md:table-cell")}>{c.idCode ?? "—"}</td>
                    <td className={cn(tableCls.td, "hidden lg:table-cell")}>
                      <span className="block">{c.contactName ?? "—"}</span>
                      <span className="block text-[11px] text-muted-foreground">{c.phone ?? ""}</span>
                    </td>
                    <td className={cn(tableCls.tdRight, "hidden text-muted-foreground sm:table-cell")}>{c.siteCount}</td>
                    <td className={cn(tableCls.tdRight, "hidden text-muted-foreground sm:table-cell")}>{c.orderCount}</td>
                    <td className={tableCls.tdRight}>{c.activeCount > 0 ? <Chip tone="accent">{c.activeCount}</Chip> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
