import { ClipboardList, Cpu, MapPin, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite, deleteClient, deleteSite, updateClient, updateSite } from "@/actions/clients";
import { createEquipment, deleteEquipment, updateEquipment } from "@/actions/equipment";
import { StatusBadge, SystemBadge } from "@/components/app/badges";
import { ClientFields, SiteFields } from "@/components/app/client-forms";
import { ConfirmButton } from "@/components/app/confirm-button";
import { EquipmentFields } from "@/components/app/equipment-forms";
import { FormDialog } from "@/components/app/form-dialog";
import { MapView } from "@/components/app/map-view";
import { PageHeader } from "@/components/app/page-header";
import { Chip, EmptyState, SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { formatDate, t } from "@/lib/i18n";
import { getClient, listOrders } from "@/lib/orders";
import { isOverdue } from "@/lib/order-utils";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const me = await requireUser(["admin", "manager"]);
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();
  const [client, orders] = await Promise.all([getClient(clientId), listOrders({ clientId, status: "all", inbox: false }, { limit: 100 })]);
  if (!client) notFound();
  const mapMarkers = client.sites
    .filter((s) => s.lat && s.lng)
    .map((s, i) => ({ id: s.id, lat: Number(s.lat), lng: Number(s.lng), code: String(i + 1), label: s.name, detail: s.address ?? undefined }));
  const activeCount = orders.filter((o) => o.status === "new" || o.status === "assigned" || o.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker={t.nav.clients}
        title={client.name}
        subtitle={[client.idCode && `ს/კ ${client.idCode}`, client.contactName, client.phone, client.email].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {me.role === "admin" && (
              <ConfirmButton
                title="კლიენტის წაშლა"
                description="კლიენტი და მისი ობიექტები წაიშლება. შეკვეთები დარჩება კლიენტის გარეშე."
                confirmLabel={t.common.delete}
                variant="destructive"
                size="sm"
                action={deleteClient.bind(null, client.id)}
                redirectTo="/clients"
              >
                <Trash2 className="size-3.5" /> {t.common.delete}
              </ConfirmButton>
            )}
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
            <Button render={<Link href={`/orders/new?client=${client.id}`} />} size="sm" className="h-10 sm:h-8">
              <Plus className="size-4" /> {t.order.new}
            </Button>
          </div>
        }
      />

      {client.notes && <p className="ln-card ln-enter p-4 text-[12.5px] text-muted-foreground">{client.notes}</p>}

      <div className="ln-enter ln-enter-2 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard
          title="ობიექტები"
          icon={MapPinned}
          aside={client.sites.length}
          action={
            <FormDialog trigger={<Button variant="outline" size="sm" />} triggerLabel={<><Plus className="size-3.5" /> ობიექტი</>} title="ახალი ობიექტი" action={createSite} submitLabel={t.common.create}>
              <SiteFields clientId={client.id} />
            </FormDialog>
          }
        >
          {client.sites.length === 0 ? (
            <EmptyState icon={MapPin} message="ობიექტები არ არის დამატებული. დაამატეთ მისამართი, რომ შეკვეთა ობიექტს დაუკავშირდეს." />
          ) : (
            <div className="space-y-4">
              {mapMarkers.length > 0 && <MapView markers={mapMarkers} height={240} showLabels={false} />}
              <ul className="space-y-2.5">
                {client.sites.map((s) => (
                  <li key={s.id} className="rounded-[14px] bg-[#f8fafd] p-4">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground [stroke-width:1.7]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{s.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {s.address}
                          {!s.lat && <span className="ml-1 text-[#96610b]">· კოორდინატები არ არის</span>}
                        </div>
                        {s.notes && <div className="mt-1 text-[11.5px] text-muted-foreground">{s.notes}</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="ობიექტის რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="ობიექტის რედაქტირება" action={updateSite.bind(null, s.id)}>
                          <SiteFields clientId={client.id} initial={s} />
                        </FormDialog>
                        <ConfirmButton title="ობიექტის წაშლა" confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteSite.bind(null, s.id)}>
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </ConfirmButton>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#e6ebf2] pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <Cpu className="size-3.5 [stroke-width:1.7]" /> აღჭურვილობა · {s.equipment.length}
                        </span>
                        <FormDialog trigger={<Button variant="ghost" size="xs" />} triggerLabel={<><Plus className="size-3" /> დამატება</>} title={`აღჭურვილობა · ${s.name}`} action={createEquipment} submitLabel={t.common.create}>
                          <EquipmentFields siteId={s.id} />
                        </FormDialog>
                      </div>
                      {s.equipment.length === 0 ? (
                        <p className="text-[11.5px] text-muted-foreground">აღჭურვილობა ჯერ არ არის ჩაწერილი.</p>
                      ) : (
                        <ul className="space-y-1">
                          {s.equipment.map((e) => (
                            <li key={e.id} className="group flex flex-wrap items-center gap-2 rounded-[8px] px-1.5 py-1 text-[11.5px] transition-colors hover:bg-white">
                              <span className="font-medium">
                                {e.quantity > 1 ? `${e.quantity} × ` : ""}
                                {e.name}
                              </span>
                              {e.model && <span className="text-muted-foreground">{e.model}</span>}
                              {e.serial && <span className="font-mono text-muted-foreground">{e.serial}</span>}
                              <SystemBadge system={e.systemType} className="px-1.5 py-0 text-[10px]" />
                              <span className="ml-auto flex gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="აღჭურვილობის რედაქტირება" />} triggerLabel={<Pencil className="size-3" />} title="აღჭურვილობის რედაქტირება" action={updateEquipment.bind(null, e.id)}>
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
        </SectionCard>

        <SectionCard
          title="შეკვეთები"
          icon={ClipboardList}
          aside={`${orders.length} სულ · ${activeCount} აქტიური`}
          action={
            <Button render={<Link href={`/orders?client=${client.id}&status=all`} />} variant="ghost" size="sm">
              ყველა
            </Button>
          }
        >
          {orders.length === 0 ? (
            <EmptyState icon={ClipboardList} message="ამ კლიენტზე შეკვეთა ჯერ არ არის." />
          ) : (
            <ul className="-mx-2 max-h-[560px] space-y-0.5 overflow-y-auto">
              {orders.slice(0, 30).map((o) => {
                const late = isOverdue(o);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-start gap-3 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-[#f8faff]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{o.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {o.number}
                          {o.site ? ` · ${o.site.name}` : ""}
                          {o.dueDate ? ` · ვადა ${formatDate(o.dueDate)}` : ""}
                          {late ? <span className="font-medium text-[#b13f32]"> · {t.order.overdue}</span> : null}
                        </span>
                      </span>
                      <StatusBadge status={o.status} className="shrink-0" />
                    </Link>
                  </li>
                );
              })}
              {orders.length > 30 && (
                <li className={cn("px-2 pt-2 text-[11px] text-muted-foreground")}>
                  ნაჩვენებია 30 / {orders.length}. დანარჩენი შეკვეთების გვერდზეა.
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </div>

      {client.sites.length > 0 && mapMarkers.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          <Chip tone="warn">რჩევა</Chip> ობიექტებს კოორდინატები არ აქვს, ამიტომ რუკაზე არ ჩანს. რედაქტირებისას მონიშნეთ ადგილი რუკაზე.
        </p>
      )}
    </div>
  );
}
