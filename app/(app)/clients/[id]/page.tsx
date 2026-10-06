import { SiteContacts } from "@/components/app/site-contacts";
import { ClipboardList, Cpu, KeyRound, MapPin, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSite, deleteClient, deleteSite, updateClient, updateSite } from "@/actions/clients";
import { createEquipment, deleteEquipment, updateEquipment } from "@/actions/equipment";
import { createUser } from "@/actions/users";
import { OverdueBadge, StatusBadge, SystemBadge } from "@/components/app/badges";
import { BulkSitesDialog } from "@/components/app/bulk-sites-dialog";
import { ClientActionsMenu } from "@/components/app/client-actions-menu";
import { ClientFields, SiteFields } from "@/components/app/client-forms";
import { ConfirmButton } from "@/components/app/confirm-button";
import { EquipmentFields } from "@/components/app/equipment-forms";
import { FormDialog } from "@/components/app/form-dialog";
import { MapView } from "@/components/app/map-switch";
import { PageHeader } from "@/components/app/page-header";
import { Chip, EmptyState, SectionCard, formFields } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, t } from "@/lib/i18n";
import { getClient, listOrders } from "@/lib/orders";
import { isOverdue, telHref } from "@/lib/order-utils";
import { listPortalLogins } from "@/lib/portal";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const me = await requireUser(["admin", "manager"]);
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();
  const [client, orders, logins] = await Promise.all([getClient(clientId), listOrders({ clientId, status: "all", inbox: false }, { limit: 100 }), listPortalLogins(clientId)]);
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
        subtitle={
          <>
            {[client.idCode && `ს/კ ${client.idCode}`, client.contactName].filter(Boolean).join(" · ")}
            {client.phone && <>{(client.idCode || client.contactName) && " · "}<a href={telHref(client.phone) ?? undefined} className="ln-link whitespace-nowrap">{client.phone}</a></>}
            {client.email && <>{(client.idCode || client.contactName || client.phone) && " · "}<a href={`mailto:${client.email}`} className="ln-link break-all">{client.email}</a></>}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button render={<Link href={`/orders/new?client=${client.id}`} />} size="sm" className="h-11 md:h-8">
              <Plus className="size-4" /> {t.order.new}
            </Button>
            <div className="md:hidden">
              <ClientActionsMenu name={client.name} editTitle="კლიენტის რედაქტირება" editAction={updateClient.bind(null, client.id)}
                secondary={me.role === "admin" ? { label: t.common.delete, title: "კლიენტის წაშლა", description: "წაიშლება კლიენტი, მისი ობიექტები, აღჭურვილობა და ტექმომსახურების გრაფიკები. შეკვეთები დარჩება კლიენტის გარეშე, კაბინეტის ლოგინი კი კომპანიის გარეშე.", action: deleteClient.bind(null, client.id), destructive: true, redirectTo: "/clients" } : undefined}>
                <ClientFields initial={client} />
              </ClientActionsMenu>
            </div>
            <div className="hidden items-center gap-2 md:flex">
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
                  description="წაიშლება კლიენტი, მისი ობიექტები, აღჭურვილობა და ტექმომსახურების გრაფიკები. შეკვეთები დარჩება კლიენტის გარეშე, კაბინეტის ლოგინი კი კომპანიის გარეშე."
                  confirmLabel={t.common.delete}
                  variant="destructive"
                  size="sm"
                  action={deleteClient.bind(null, client.id)}
                  redirectTo="/clients"
                >
                  <Trash2 className="size-3.5" /> {t.common.delete}
                </ConfirmButton>
              )}
            </div>
          </div>
        }
      />

      {client.notes && <p className="ln-card ln-enter p-4 text-[12.5px] text-muted-foreground">{client.notes}</p>}

      <div className="ln-enter ln-enter-2 grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard
          className="max-md:p-4"
          title="ობიექტები"
          icon={MapPinned}
          aside={client.sites.length}
          action={
            <div className="flex gap-2 max-md:[&_button]:h-11 max-md:[&_button]:px-2">
              <BulkSitesDialog clientId={client.id} />
              <FormDialog trigger={<Button variant="outline" size="sm" />} triggerLabel={<><Plus className="size-3.5" /> ობიექტი</>} title="ახალი ობიექტი" action={createSite} submitLabel={t.common.create}>
                <SiteFields clientId={client.id} />
              </FormDialog>
            </div>
          }
        >
          {client.sites.length === 0 ? (
            <EmptyState icon={MapPin} message="ობიექტები არ არის დამატებული. დაამატეთ მისამართი, რომ შეკვეთა ობიექტს დაუკავშირდეს." />
          ) : (
            <div className="space-y-4">
              {mapMarkers.length > 0 && <MapView markers={mapMarkers} height={240} showLabels={false} />}
              <ul className="max-md:divide-y max-md:divide-[#e6ebf2] md:space-y-2.5">
                {client.sites.map((s) => (
                  <li key={s.id} className="py-4 first:pt-0 last:pb-0 md:rounded-[14px] md:bg-[#f8faff] md:p-4 md:first:pt-4 md:last:pb-4">
                    <div className="relative flex items-start gap-2.5">
                      <MapPin className="mt-0.5 hidden size-4 shrink-0 text-muted-foreground [stroke-width:1.7] md:block" />
                      <div className="min-w-0 flex-1">
                        <div className="min-h-11 pr-12 text-[13px] font-medium md:min-h-0 md:pr-0">{s.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">
                          {s.address}
                          {!s.lat && <span className="ml-1 text-[#96610b]">· კოორდინატები არ არის</span>}
                        </div>
                        {(s.contactName || s.contactPhone) && (
                          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {s.contactName}
                            {s.contactName && s.contactPhone && " · "}
                            {s.contactPhone && <a href={telHref(s.contactPhone) ?? undefined} className="ln-link whitespace-nowrap">{s.contactPhone}</a>}
                          </div>
                        )}
                        {s.notes && <div className="mt-1 text-[11.5px] text-muted-foreground">{s.notes}</div>}
                      </div>
                      <div className="absolute right-0 top-0 md:hidden">
                        <ClientActionsMenu name={s.name} editTitle="ობიექტის რედაქტირება" editAction={updateSite.bind(null, s.id)}
                          secondary={{ label: t.common.delete, title: "ობიექტის წაშლა", description: "ობიექტის აღჭურვილობა წაიშლება. შეკვეთები დარჩება ობიექტის გარეშე.", action: deleteSite.bind(null, s.id), destructive: true }}>
                          <SiteFields clientId={client.id} initial={s} />
                        </ClientActionsMenu>
                      </div>
                      <div className="hidden shrink-0 gap-1 md:flex">
                        <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="ობიექტის რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="ობიექტის რედაქტირება" action={updateSite.bind(null, s.id)}>
                          <SiteFields clientId={client.id} initial={s} />
                        </FormDialog>
                        <ConfirmButton title="ობიექტის წაშლა" description="ობიექტის აღჭურვილობა წაიშლება. შეკვეთები დარჩება ობიექტის გარეშე." confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteSite.bind(null, s.id)}>
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </ConfirmButton>
                      </div>
                    </div>

                    <SiteContacts siteId={s.id} staff />
                    {/* an empty equipment block repeated per branch is noise; then only the add link stays */}
                    <div className="mt-2 border-t border-[#e6ebf2] pt-1 md:mt-3 md:pt-3">
                      <div className={cn("flex items-center justify-between gap-2", s.equipment.length > 0 && "mb-2")}>
                        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <Cpu className="size-3.5 [stroke-width:1.7]" /> აღჭურვილობა {s.equipment.length > 0 ? `· ${s.equipment.length}` : ""}
                        </span>
                        <FormDialog trigger={<Button variant="ghost" size="xs" className="max-md:h-11" />} triggerLabel={<><Plus className="size-3" /> დამატება</>} title={`აღჭურვილობა · ${s.name}`} action={createEquipment} submitLabel={t.common.create}>
                          <EquipmentFields siteId={s.id} />
                        </FormDialog>
                      </div>
                      {s.equipment.length === 0 ? null : (
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
                              <span className="ml-auto flex gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                <FormDialog trigger={<Button variant="ghost" size="icon-xs" className="max-md:size-11" aria-label="აღჭურვილობის რედაქტირება" />} triggerLabel={<Pencil className="size-3" />} title="აღჭურვილობის რედაქტირება" action={updateEquipment.bind(null, e.id)}>
                                  <EquipmentFields siteId={s.id} initial={e} />
                                </FormDialog>
                                <ConfirmButton title="წაშლა" confirmLabel={t.common.delete} variant="ghost" size="xs" className="max-md:size-11" ariaLabel="აღჭურვილობის წაშლა" action={deleteEquipment.bind(null, e.id)}>
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
          className="max-md:p-4"
          title="შეკვეთები"
          icon={ClipboardList}
          aside={`${orders.length} სულ · ${activeCount} აქტიური`}
          action={
            <Button render={<Link href={`/orders?client=${client.id}&status=all`} />} variant="ghost" size="sm" className="max-md:h-11">
              ყველა
            </Button>
          }
        >
          {orders.length === 0 ? (
            <EmptyState icon={ClipboardList} message="ამ კლიენტზე შეკვეთა ჯერ არ არის." />
          ) : (
            <ul className="-mx-2 divide-y divide-[#eef1f6] md:max-h-[560px] md:space-y-0.5 md:divide-y-0 md:overflow-y-auto">
              {orders.slice(0, 30).map((o) => {
                const late = isOverdue(o);
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex flex-wrap items-start gap-2 rounded-[12px] px-2 py-2.5 md:flex-nowrap md:gap-3 transition-colors hover:bg-[#f8faff]">
                      <span className="min-w-0 basis-full md:flex-1 md:basis-auto">
                        <span className="block text-[13px] font-medium md:truncate">{o.title}</span>
                        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-[6px] text-[11px] text-muted-foreground">
                          <span className="min-w-0 break-words md:truncate">
                            {o.number}
                            {o.site ? ` · ${o.site.name}` : ""}
                            {o.dueDate ? ` · ვადა ${formatDate(o.dueDate)}` : ""}
                          </span>
                          {late && <OverdueBadge />}
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

      <SectionCard
        className="max-md:p-4 max-md:[&_button]:h-11"
        title="კლიენტის კაბინეტი"
        icon={KeyRound}
        aside={logins.length}
        action={
          me.role === "admin" ? (
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={
                <>
                  <Plus className="size-3.5" /> წვდომის დამატება
                </>
              }
              title="კაბინეტის მომხმარებელი"
              description={`შევა ელფოსტით და პაროლით, ნახავს მხოლოდ კომპანიის „${client.name}“ შეკვეთებს და გამოგზავნის ახალ მოთხოვნას.`}
              action={createUser}
              submitLabel={t.common.create}
              successMessage="წვდომა დაემატა"
            >
              <input type="hidden" name="role" value="client" />
              <input type="hidden" name="clientId" value={client.id} />
              <div className={cn("grid gap-3 sm:grid-cols-2", formFields)}>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pa-name">სახელი, გვარი *</Label>
                  <Input id="pa-name" name="name" required minLength={2} defaultValue={client.contactName ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pa-email">ელფოსტა *</Label>
                  <Input id="pa-email" name="email" type="email" required defaultValue={client.email ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pa-phone">ტელეფონი</Label>
                  <Input id="pa-phone" name="phone" defaultValue={client.phone ?? ""} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pa-password">პაროლი *</Label>
                  <Input id="pa-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
              </div>
            </FormDialog>
          ) : undefined
        }
      >
        {logins.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            კლიენტს კაბინეტი ჯერ არ აქვს. წვდომის მიცემის შემდეგ თავად გამოგზავნის მოთხოვნას და ნახავს მის სტატუსს{me.role === "admin" ? "." : "; წვდომას ადმინი ამატებს."}
          </p>
        ) : (
          <ul className="divide-y divide-[#eef1f6] md:space-y-1 md:divide-y-0">
            {logins.map((l) => (
              <li key={l.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-[12px] px-2 py-2 text-[13px]", l.banned && "opacity-60")}>
                <span className="min-w-0 max-md:basis-full">
                  <span className="block break-words font-medium">{l.name}</span>
                  <span className="block break-all text-[11.5px] text-muted-foreground md:truncate">{l.email && <a href={`mailto:${l.email}`} className="ln-link">{l.email}</a>}</span>
                </span>
                {l.banned ? <Chip tone="warn">დეაქტივირებული</Chip> : <Chip tone="accent">აქტიური</Chip>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {client.sites.length > 0 && mapMarkers.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          <Chip tone="warn">რჩევა</Chip> ობიექტებს კოორდინატები არ აქვს, ამიტომ რუკაზე არ ჩანს. რედაქტირებისას მონიშნეთ ადგილი რუკაზე.
        </p>
      )}
    </div>
  );
}
