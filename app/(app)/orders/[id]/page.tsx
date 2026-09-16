import { Building2, CalendarClock, CalendarDays, Mail, MapPin, Pencil, Phone, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listTemplates } from "@/actions/order-work";
import { deleteOrder } from "@/actions/orders";
import { OverdueBadge, PaymentBadge, PriorityLabel, StatusBadge, SystemBadge, TypeBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MapView } from "@/components/app/map-view";
import { AssigneesEditor } from "@/components/app/order-detail/assignees-editor";
import { Attachments } from "@/components/app/order-detail/attachments";
import { Checklist } from "@/components/app/order-detail/checklist";
import { Comments } from "@/components/app/order-detail/comments";
import { MarkSeen } from "@/components/app/order-detail/mark-seen";
import { Materials } from "@/components/app/order-detail/materials";
import { PaymentSelect } from "@/components/app/order-detail/payment-select";
import { StatusActions } from "@/components/app/order-detail/status-actions";
import { TimeOnSite } from "@/components/app/order-detail/time-on-site";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_LABELS, PAYMENT_LABELS, STATUS_LABELS, formatDate, formatMoney, t } from "@/lib/i18n";
import { getOrder, listAssignableUsers } from "@/lib/orders";
import { isOverdue } from "@/lib/order-utils";
import { isStaff, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const order = await getOrder(Number(id));
  return { title: order ? `${order.number} ${order.title}` : "შეკვეთა" };
}

function eventText(type: string, data: Record<string, unknown> | null) {
  const base = EVENT_LABELS[type] ?? type;
  if (type === "status_changed" && data) {
    return `${base}: ${STATUS_LABELS[data.from as keyof typeof STATUS_LABELS] ?? data.from} → ${STATUS_LABELS[data.to as keyof typeof STATUS_LABELS] ?? data.to}`;
  }
  if (type === "payment_changed" && data) {
    return `${base}: ${PAYMENT_LABELS[data.from as keyof typeof PAYMENT_LABELS] ?? data.from} → ${PAYMENT_LABELS[data.to as keyof typeof PAYMENT_LABELS] ?? data.to}`;
  }
  if ((type === "assigned" || type === "unassigned") && Array.isArray(data?.users)) return `${base}: ${(data!.users as string[]).join(", ")}`;
  if (type === "attachment_added" && data?.fileName) return `${base}: ${data.fileName}`;
  if (type === "created_from_email" && data?.from) return `${base}: ${data.from}`;
  if ((type === "material_added" || type === "material_removed") && data?.name) return `${base}: ${data.name}${data.quantity ? ` (${data.quantity} ${data.unit ?? ""})` : ""}`;
  return base;
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const me = await requireUser();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const order = await getOrder(orderId);
  if (!order) notFound();
  const staff = isStaff(me.role);
  const isAssignee = order.assignees.some((a) => a.userId === me.id);
  if (!staff && !isAssignee) notFound();
  const [users, templates] = await Promise.all([staff ? listAssignableUsers() : Promise.resolve([]), staff ? listTemplates() : Promise.resolve([])]);
  const overdue = isOverdue(order);
  const siteCoords = order.site?.lat && order.site?.lng ? { lat: Number(order.site.lat), lng: Number(order.site.lng) } : null;

  return (
    <div className="space-y-4">
      {!staff && <MarkSeen orderId={order.id} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{order.number}</span>
            <StatusBadge status={order.status} />
            <TypeBadge type={order.type} />
            <SystemBadge system={order.systemType} />
            <PriorityLabel priority={order.priority} />
            {overdue && <OverdueBadge />}
            {!order.triaged && <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-medium text-white">შემოსული წერილი</span>}
          </div>
          <h1 className="text-xl font-semibold leading-snug md:text-2xl">{order.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href={`/orders/${order.id}/sheet`} target="_blank" />} variant="outline" size="sm">
            სამუშაო ფურცელი
          </Button>
          {staff && (
            <Button render={<Link href={`/orders/${order.id}/edit`} />} variant="outline" size="sm">
              <Pencil className="size-3.5" /> {t.common.edit}
            </Button>
          )}
          {me.role === "admin" && (
            <ConfirmButton
              title="შეკვეთის წაშლა"
              description="შეკვეთა, კომენტარები და ფაილები სამუდამოდ წაიშლება."
              confirmLabel={t.common.delete}
              action={deleteOrder.bind(null, order.id)}
              redirectTo="/orders"
            >
              {t.common.delete}
            </ConfirmButton>
          )}
        </div>
      </div>

      <StatusActions orderId={order.id} status={order.status} role={me.role} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.order.description}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.source === "email" && (
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {order.emailFrom}
                  </span>
                  {order.emailSubject && <span>თემა: {order.emailSubject}</span>}
                  <span>{formatDate(order.emailReceivedAt ?? order.createdAt, true)}</span>
                </div>
              )}
              {order.description ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{order.description}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">აღწერა არ არის</p>
              )}
            </CardContent>
          </Card>

          <Checklist
            orderId={order.id}
            items={order.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done, doneAt: c.doneAt, doneByUser: c.doneByUser }))}
            templates={templates.map((x) => ({ id: x.id, name: x.name, systemType: x.systemType }))}
            staff={staff}
          />
          <Materials orderId={order.id} materials={order.materials} staff={staff} meId={me.id} amount={order.amount} />
          <Attachments orderId={order.id} attachments={order.attachments} canDelete={staff} />
          <Comments orderId={order.id} comments={order.comments} meId={me.id} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.order.timeOnSite}</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeOnSite
                orderId={order.id}
                scheduledAt={order.scheduledAt}
                createdAt={order.createdAt}
                arrivedAt={order.arrivedAt}
                finishedAt={order.finishedAt}
                canAct={staff || isAssignee}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">დეტალები</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{t.order.client}</div>
                  {order.client ? (
                    staff ? (
                      <Link href={`/clients/${order.client.id}`} className="font-medium hover:text-sky-700">
                        {order.client.name}
                      </Link>
                    ) : (
                      <div className="font-medium">{order.client.name}</div>
                    )
                  ) : (
                    <div className="text-muted-foreground">—</div>
                  )}
                  {order.client?.contactName && <div className="text-xs text-muted-foreground">{order.client.contactName}</div>}
                  {order.client?.phone && (
                    <a href={`tel:${order.client.phone}`} className="flex items-center gap-1 text-xs text-sky-700">
                      <Phone className="size-3" /> {order.client.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{t.order.site}</div>
                  <div className="font-medium">{order.site?.name ?? "—"}</div>
                  {(order.address || order.site?.address) && (
                    <a
                      href={`https://maps.google.com/?q=${siteCoords ? `${siteCoords.lat},${siteCoords.lng}` : encodeURIComponent(order.address ?? order.site?.address ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-700 hover:underline"
                    >
                      {order.address ?? order.site?.address}
                    </a>
                  )}
                  {siteCoords && (
                    <div className="mt-2">
                      <MapView height={160} markers={[{ id: order.id, lat: siteCoords.lat, lng: siteCoords.lng, label: order.site?.name }]} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{t.order.scheduledAt}</div>
                  <div className="font-medium">{order.scheduledAt ? formatDate(order.scheduledAt, true) : "—"}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{t.order.dueDate}</div>
                  <div className={overdue ? "font-semibold text-rose-600" : "font-medium"}>{formatDate(order.dueDate)}</div>
                </div>
              </div>
              {(order.warrantyMonths || order.warrantyUntil) && (
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">{t.order.warranty}</div>
                    <div className="font-medium">
                      {order.warrantyMonths ? `${order.warrantyMonths} თვე` : ""}
                      {order.warrantyUntil ? ` · ${formatDate(order.warrantyUntil)}-მდე` : order.warrantyMonths ? " · დაიწყება ჩაბარებისას" : ""}
                    </div>
                  </div>
                </div>
              )}
              {staff && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 size-4 shrink-0 text-center text-xs font-bold text-muted-foreground">₾</span>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{t.order.amount}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatMoney(order.amount)}</span>
                      <PaymentSelect orderId={order.id} value={order.paymentStatus} />
                    </div>
                  </div>
                </div>
              )}
              {!staff && order.amount && (
                <div className="text-xs text-muted-foreground">
                  <PaymentBadge status={order.paymentStatus} />
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">{t.order.createdAt}</div>
                  <div className="font-medium">{formatDate(order.createdAt, true)}</div>
                  {order.creator && <div className="text-xs text-muted-foreground">{order.creator.name}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t.order.assignees}</CardTitle>
              {staff && <AssigneesEditor orderId={order.id} users={users} selected={order.assignees.map((a) => a.userId)} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {order.assignees.length === 0 && <p className="text-sm text-muted-foreground">{t.order.unassigned}</p>}
              {order.assignees.map((a) => (
                <div key={a.userId} className="flex items-center gap-2.5">
                  <UserAvatar name={a.user.name} image={a.user.image} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.user.name}</div>
                    {a.user.phone && (
                      <a href={`tel:${a.user.phone}`} className="text-xs text-muted-foreground hover:text-sky-700">
                        {a.user.phone}
                      </a>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{a.seenAt ? "ნანახია" : "არ უნახავს"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.order.history}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5 border-l pl-4 text-sm">
                {order.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <div>{eventText(e.type, e.data)}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.user?.name ?? "სისტემა"} · {formatDate(e.createdAt, true)}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
