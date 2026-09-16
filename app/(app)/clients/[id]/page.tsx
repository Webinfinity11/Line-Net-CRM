import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite, deleteClient, deleteSite, updateClient, updateSite } from "@/actions/clients";
import { ClientFields, SiteFields } from "@/components/app/client-forms";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { OrderTable } from "@/components/app/order-table";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { getClient, listOrders } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const me = await requireUser(["admin", "manager"]);
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();
  const [client, orders] = await Promise.all([getClient(clientId), listOrders({ clientId, status: "all", inbox: false }, { limit: 100 })]);
  if (!client) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={client.name}
        subtitle={[client.idCode && `ს/კ ${client.idCode}`, client.contactName, client.phone, client.email].filter(Boolean).join(" · ")}
        actions={
          <>
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={
                <>
                  <Pencil className="size-3.5" /> {t.common.edit}
                </>
              }
              title="კლიენტის რედაქტირება"
              action={updateClient.bind(null, client.id)}
            >
              <ClientFields initial={client} />
            </FormDialog>
            {me.role === "admin" && (
              <ConfirmButton
                title="კლიენტის წაშლა"
                description="კლიენტი და მისი ობიექტები წაიშლება. შეკვეთები დარჩება კლიენტის გარეშე."
                confirmLabel={t.common.delete}
                action={deleteClient.bind(null, client.id)}
                redirectTo="/clients"
              >
                <Trash2 className="size-3.5" /> {t.common.delete}
              </ConfirmButton>
            )}
            <Button render={<Link href={`/orders/new?client=${client.id}`} />} size="sm" className="bg-sky-600 hover:bg-sky-700">
              <Plus className="size-4" /> {t.order.new}
            </Button>
          </>
        }
      />

      {client.notes && <p className="rounded-lg border bg-white p-3 text-sm dark:bg-neutral-900">{client.notes}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">ობიექტები · {client.sites.length}</CardTitle>
          <FormDialog trigger={<Button variant="outline" size="sm" />} triggerLabel={<><Plus className="size-3.5" /> ობიექტი</>} title="ახალი ობიექტი" action={createSite} submitLabel={t.common.create}>
            <SiteFields clientId={client.id} />
          </FormDialog>
        </CardHeader>
        <CardContent>
          {client.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">ობიექტები არ არის დამატებული</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {client.sites.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 rounded-lg border p-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.address}</div>
                    {s.notes && <div className="mt-1 text-xs text-neutral-600">{s.notes}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="ობიექტის რედაქტირება" action={updateSite.bind(null, s.id)}>
                      <SiteFields clientId={client.id} initial={s} />
                    </FormDialog>
                    <ConfirmButton title="ობიექტის წაშლა" confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteSite.bind(null, s.id)}>
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">შეკვეთები · {orders.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <OrderTable orders={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
