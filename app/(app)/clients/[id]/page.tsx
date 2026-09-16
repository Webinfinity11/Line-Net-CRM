import { Cpu, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite, deleteClient, deleteSite, updateClient, updateSite } from "@/actions/clients";
import { createEquipment, deleteEquipment, updateEquipment } from "@/actions/equipment";
import { EquipmentFields } from "@/components/app/equipment-forms";
import { MapView } from "@/components/app/map-view";
import { SystemBadge } from "@/components/app/badges";
import { ClientFields, SiteFields } from "@/components/app/client-forms";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { OrderTable } from "@/components/app/order-table";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, t } from "@/lib/i18n";
import { getClient, listOrders } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const me = await requireUser(["admin", "manager"]);
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();
  const [client, orders] = await Promise.all([getClient(clientId), listOrders({ clientId, status: "all", inbox: false }, { limit: 100 })]);
  if (!client) notFound();
  const mapMarkers = client.sites.filter((s) => s.lat && s.lng).map((s) => ({ id: s.id, lat: Number(s.lat), lng: Number(s.lng), label: s.name }));

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
            <Button render={<Link href={`/orders/new?client=${client.id}`} />} size="sm">
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
            <div className="space-y-3">
              {mapMarkers.length > 0 && <MapView markers={mapMarkers} height={220} />}
              <ul className="grid gap-2 md:grid-cols-2">
                {client.sites.map((s) => (
                  <li key={s.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.address}
                          {!s.lat && <span className="ml-1 text-amber-600">· კოორდინატები არ არის</span>}
                        </div>
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
                    </div>
                    <div className="mt-2 border-t pt-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Cpu className="size-3.5" /> აღჭურვილობა · {s.equipment.length}
                        </span>
                        <FormDialog trigger={<Button variant="ghost" size="xs" />} triggerLabel={<><Plus className="size-3" /> დამატება</>} title={`აღჭურვილობა · ${s.name}`} action={createEquipment} submitLabel={t.common.create}>
                          <EquipmentFields siteId={s.id} />
                        </FormDialog>
                      </div>
                      {s.equipment.length === 0 ? (
                        <p className="text-xs text-muted-foreground">რა დგას ამ ობიექტზე, ჯერ არ არის ჩაწერილი.</p>
                      ) : (
                        <ul className="space-y-1">
                          {s.equipment.map((e) => (
                            <li key={e.id} className="group flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800">
                              <span className="font-medium">
                                {e.quantity > 1 ? `${e.quantity} × ` : ""}
                                {e.name}
                              </span>
                              {e.model && <span className="text-muted-foreground">{e.model}</span>}
                              {e.serial && <span className="font-mono text-muted-foreground">{e.serial}</span>}
                              <SystemBadge system={e.systemType} className="px-1.5 py-0 text-[10px]" />
                              {e.warrantyUntil && <span className="text-muted-foreground">გარანტია {formatDate(e.warrantyUntil)}</span>}
                              <span className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100">
                                <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="რედაქტირება" />} triggerLabel={<Pencil className="size-3" />} title="აღჭურვილობის რედაქტირება" action={updateEquipment.bind(null, e.id)}>
                                  <EquipmentFields siteId={s.id} initial={e} />
                                </FormDialog>
                                <ConfirmButton title="წაშლა" confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteEquipment.bind(null, e.id)}>
                                  <Trash2 className="size-3 text-muted-foreground" />
                                </ConfirmButton>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
