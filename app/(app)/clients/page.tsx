import { count, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/actions/clients";
import { ClientFields } from "@/components/app/client-forms";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clients, orders, sites } from "@/db/schema";
import { t } from "@/lib/i18n";
import { requireUser } from "@/lib/session";

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
    <div>
      <PageHeader
        title={t.nav.clients}
        subtitle={`${rows.length} კლიენტი`}
        actions={
          <FormDialog
            trigger={<Button className="bg-sky-600 hover:bg-sky-700" />}
            triggerLabel={
              <>
                <Plus className="size-4" /> ახალი კლიენტი
              </>
            }
            title="ახალი კლიენტი"
            action={createClient}
            submitLabel={t.common.create}
          >
            <ClientFields />
          </FormDialog>
        }
      />
      <form method="get" className="mb-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="ძებნა კლიენტებში..."
          className="h-9 w-full max-w-sm rounded-lg border bg-white px-3 text-sm outline-none focus:border-sky-500 dark:bg-neutral-900"
        />
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">კომპანია</th>
              <th className="px-3 py-2.5 font-medium">ს/კ</th>
              <th className="px-3 py-2.5 font-medium">კონტაქტი</th>
              <th className="px-3 py-2.5 text-center font-medium">ობიექტები</th>
              <th className="px-3 py-2.5 text-center font-medium">შეკვეთები</th>
              <th className="px-3 py-2.5 text-center font-medium">აქტიური</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {t.common.noResults}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                <td className="px-4 py-2.5">
                  <Link href={`/clients/${c.id}`} className="font-medium hover:text-sky-700">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.idCode ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <div>{c.contactName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </td>
                <td className="px-3 py-2.5 text-center">{c.siteCount}</td>
                <td className="px-3 py-2.5 text-center">{c.orderCount}</td>
                <td className="px-3 py-2.5 text-center">
                  {c.activeCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{c.activeCount}</span> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
