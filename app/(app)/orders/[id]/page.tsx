import { Building2, CalendarClock, CalendarDays, Camera, Mail, MapPin, Pencil, Phone, Printer, ShieldCheck, Trash2, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteOrder } from "@/actions/orders";
import { OverdueBadge, PriorityLabel, StatusBadge, SystemBadge, TypeBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MapView } from "@/components/app/map-view";
import { AssigneesEditor } from "@/components/app/order-detail/assignees-editor";
import { Attachments } from "@/components/app/order-detail/attachments";
import { Checklist } from "@/components/app/order-detail/checklist";
import { Comments } from "@/components/app/order-detail/comments";
import { MarkSeen } from "@/components/app/order-detail/mark-seen";
import { Materials } from "@/components/app/order-detail/materials";
import { Payments } from "@/components/app/order-detail/payments";
import { StatusActions } from "@/components/app/order-detail/status-actions";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHODS } from "@/lib/finance";
import { EVENT_LABELS, PAYMENT_LABELS, STATUS_LABELS, formatDate, formatDuration, formatMoney, t } from "@/lib/i18n";
import { listTemplates } from "@/lib/checklists";
import { getOrderForUser, listAssignableUsers, plannedMinutesByUser } from "@/lib/orders";
import { AssignDialog } from "@/components/app/assign-form";
import { getWorkHoursPerDay } from "@/lib/settings";
import { isOverdue } from "@/lib/order-utils";
import { plannedEnd, tbilisiTime, tbilisiToday } from "@/lib/schedule-utils";
import { isStaff, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return { title: `შეკვეთა ${id}` };
}

function eventText(type: string, data: Record<string, unknown> | null) {
  const base = EVENT_LABELS[type] ?? type;
  const st = (v: unknown) => STATUS_LABELS[v as keyof typeof STATUS_LABELS] ?? String(v);
  if ((type === "status_changed" || type === "reopened" || type === "verified_closed") && data) return `${base}: ${st(data.from)} → ${st(data.to)}`;
  if (type === "payment_changed" && data) return `${base}: ${PAYMENT_LABELS[data.from as keyof typeof PAYMENT_LABELS] ?? data.from} → ${PAYMENT_LABELS[data.to as keyof typeof PAYMENT_LABELS] ?? data.to}`;
  if (type === "payment_added" && data) return `${base}: ${formatMoney(data.amount as number)} (${PAYMENT_METHODS[String(data.method)] ?? data.method})${data.status ? ` → ${PAYMENT_LABELS[data.status as keyof typeof PAYMENT_LABELS]}` : ""}`;
  if (type === "payment_removed" && data) return `${base}: ${formatMoney(data.amount as number)}`;
  if ((type === "assigned" || type === "unassigned") && Array.isArray(data?.users)) return `${base}: ${(data!.users as string[]).join(", ")}`;
  if ((type === "attachment_added" || type === "attachment_removed") && data?.fileName) return `${base}: ${data.fileName}`;
  if (type === "created_from_email" && data?.from) return `${base}: ${data.from}`;
  if ((type === "material_added" || type === "material_removed") && data?.name) return `${base}: ${data.name}${data.quantity ? ` (${data.quantity} ${data.unit ?? ""})` : ""}`;
  if (type === "visit_ended" && typeof data?.minutes === "number") return `${base} (${formatDuration(data.minutes)})`;
  if (type === "updated" && data?.amountTo !== undefined) return `${base}: თანხა ${formatMoney(data.amountFrom as string)} → ${formatMoney(data.amountTo as string)}`;
  return base;
}

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const me = await requireUser();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const view = await getOrderForUser(orderId, me);
  if (!view) notFound();
  const { order, financeVisible } = view;
  const staff = isStaff(me.role);
  const isAssignee = order.assignees.some((a) => a.userId === me.id);
  const readOnly = order.status === "closed" && me.role !== "admin";
  const [users, templates, plannedToday, normHours] = await Promise.all([staff ? listAssignableUsers() : Promise.resolve([]), staff ? listTemplates() : Promise.resolve([]), staff ? plannedMinutesByUser(tbilisiToday()) : Promise.resolve({} as Record<string, number>), getWorkHoursPerDay()]);
  const executorOptions = users.filter((u) => u.role === "executor").map((u) => ({ id: u.id, name: u.name, image: u.image, specializations: u.specializations ?? [], hours: Math.round(((plannedToday[u.id] ?? 0) / 60) * 10) / 10 }));
  const overdue = isOverdue(order);
  const siteCoords = order.site?.lat && order.site?.lng ? { lat: Number(order.site.lat), lng: Number(order.site.lng) } : null;
  const address = order.address ?? order.site?.address ?? null;
  const requiredLeft = order.checklist.filter((c) => c.required && !c.done).length;
  const hasPhoto = order.attachments.some((a) => a.mimeType?.startsWith("image/"));
  const needsPhoto = order.requiresPhoto && !hasPhoto;
  const plannedEndAt = order.scheduledAt ? plannedEnd(order.scheduledAt, order.plannedMinutes) : null;

  return (
    <div className="space-y-4">
      {!staff && <MarkSeen orderId={order.id} />}

      {/* Summary header: status, people, place, time, next action */}
      <div className="rounded-2xl border bg-white p-4 dark:bg-neutral-900 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{order.number}</span>
              <StatusBadge status={order.status} />
              <TypeBadge type={order.type} />
              <SystemBadge system={order.systemType} />
              <PriorityLabel priority={order.priority} />
              {overdue && <OverdueBadge />}
              {!order.triaged && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">შემოსული წერილი</span>}
              {order.requiresPhoto && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
                  <Camera className="size-3" /> ფოტო სავალდებულოა
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold leading-snug break-words md:text-2xl">{order.title}</h1>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t.order.client} / {t.order.site}</dt>
                  <dd className="font-medium">
                    {order.client ? (staff ? <Link href={`/clients/${order.client.id}`} className="hover:text-blue-700">{order.client.name}</Link> : order.client.name) : "—"}
                    {order.site ? <span className="text-muted-foreground"> · {order.site.name}</span> : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t.order.scheduledAt}</dt>
                  <dd className="font-medium">
                    {order.scheduledAt ? `${formatDate(order.scheduledAt, true)}${plannedEndAt ? ` – ${tbilisiTime(plannedEndAt)}` : ""}` : "დაუგეგმავი"}
                    {order.plannedMinutes ? <span className="text-xs text-muted-foreground"> · {formatDuration(order.plannedMinutes)}</span> : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t.order.dueDate}</dt>
                  <dd className={overdue ? "font-semibold text-rose-600" : "font-medium"}>{formatDate(order.dueDate)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t.order.assignees}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5 font-medium">
                    {order.assignees.length === 0 && <span className="text-rose-600">{t.order.unassigned}</span>}
                    {order.assignees.map((a) => (
                      <span key={a.userId} className="inline-flex items-center gap-1">
                        <UserAvatar name={a.user.name} image={a.user.image} size="xs" /> {a.user.name.split(" ")[0]}
                      </span>
                    ))}
                    {staff && !readOnly && <AssigneesEditor orderId={order.id} users={users} selected={order.assignees.map((a) => a.userId)} />}
                    {staff && !readOnly && (
                      <AssignDialog
                        orderId={order.id}
                        title={order.title}
                        systemType={order.systemType}
                        executors={executorOptions}
                        normHours={normHours}
                        defaultAssigneeId={order.assignees[0]?.userId ?? null}
                        defaultDate={order.scheduledAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(order.scheduledAt) : tbilisiToday()}
                        defaultTime={order.scheduledAt ? tbilisiTime(order.scheduledAt) : null}
                        defaultMinutes={order.plannedMinutes}
                        size="xs"
                      />
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button render={<Link href={`/orders/${order.id}/sheet`} target="_blank" />} variant="outline" size="sm">
              <Printer className="size-3.5" /> სამუშაო ფურცელი
            </Button>
            {staff && !readOnly && (
              <Button render={<Link href={`/orders/${order.id}/edit`} />} variant="outline" size="sm">
                <Pencil className="size-3.5" /> {t.common.edit}
              </Button>
            )}
          </div>
        </div>
      </div>

      <StatusActions orderId={order.id} status={order.status} role={me.role} isAssignee={isAssignee} requiredLeft={requiredLeft} needsPhoto={needsPhoto} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Work column */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>სამუშაო</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.source === "email" && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {order.emailFrom}
                  </span>
                  {order.emailSubject && <span>თემა: {order.emailSubject}</span>}
                  <span>{formatDate(order.emailReceivedAt ?? order.createdAt, true)}</span>
                </div>
              )}
              {order.description ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{order.description}</pre> : <p className="text-sm text-muted-foreground">აღწერა არ არის</p>}
              {order.completionNote && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:bg-emerald-950/20">
                  <div className="mb-0.5 text-xs font-medium text-emerald-800">შესრულებული სამუშაო (ჩაბარებისას)</div>
                  <pre className="whitespace-pre-wrap font-sans">{order.completionNote}</pre>
                </div>
              )}
              {order.status === "closed" && order.verifier && (
                <p className="text-xs text-muted-foreground">
                  შემოწმდა და დაიხურა: {order.verifier.name} · {formatDate(order.verifiedAt, true)}
                </p>
              )}
            </CardContent>
          </Card>

          <Checklist
            orderId={order.id}
            items={order.checklist.map((c) => ({ id: c.id, label: c.label, required: c.required, done: c.done, doneAt: c.doneAt, doneByUser: c.doneByUser }))}
            templates={templates.map((x) => ({ id: x.id, name: x.name, systemType: x.systemType }))}
            staff={staff}
            readOnly={readOnly}
          />


          <Materials orderId={order.id} materials={order.materials} financeVisible={financeVisible} meId={me.id} amount={order.amount} readOnly={readOnly} />

          {financeVisible && (
            <Payments
              orderId={order.id}
              amount={order.amount}
              paidTotal={order.paidTotal}
              paymentStatus={order.paymentStatus}
              reviewNeeded={order.paymentReviewNeeded}
              payments={order.payments}
              meId={me.id}
              isAdmin={me.role === "admin"}
              disabled={readOnly}
            />
          )}

          <Attachments orderId={order.id} attachments={order.attachments} canDelete={staff && !readOnly} />
          <Comments orderId={order.id} comments={order.comments} meId={me.id} />
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>ობიექტი და კონტაქტი</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{order.site?.name ?? "—"}</div>
                  {address && (
                    <a
                      href={`https://maps.google.com/?q=${siteCoords ? `${siteCoords.lat},${siteCoords.lng}` : encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 hover:underline"
                    >
                      {address}
                    </a>
                  )}
                  {siteCoords && (
                    <div className="mt-2">
                      <MapView height={200} showLabels={false} markers={[{ id: order.id, lat: siteCoords.lat, lng: siteCoords.lng, code: "●", label: order.site?.name ?? undefined, detail: address ?? undefined }]} />
                    </div>
                  )}
                </div>
              </div>
              {order.client && (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{order.client.contactName ?? order.client.name}</div>
                    {order.client.phone ? (
                      <a href={`tel:${order.client.phone.replace(/\s+/g, "")}`} className="text-xs text-blue-700 hover:underline">
                        {order.client.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">ტელეფონი არ არის</span>
                    )}
                  </div>
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
              {order.assignees.length > 0 && (
                <div className="border-t pt-3">
                  <div className="mb-1.5 text-xs text-muted-foreground">{t.order.assignees}</div>
                  {order.assignees.map((a) => (
                    <div key={a.userId} className="flex items-center gap-2.5 py-1">
                      <UserAvatar name={a.user.name} image={a.user.image} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.user.name}</div>
                        {a.user.phone && (
                          <a href={`tel:${a.user.phone.replace(/\s+/g, "")}`} className="text-xs text-muted-foreground hover:text-blue-700">
                            {a.user.phone}
                          </a>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{a.seenAt ? "ნანახია" : "არ უნახავს"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle>{t.order.history}</CardTitle>
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

          {me.role === "admin" && (
            <Card className="ring-rose-200">
              <CardHeader className="pb-1">
                <CardTitle className="text-rose-700">საშიში მოქმედებები</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">წაშლა შეუქცევადია: შეკვეთა, ვიზიტები, გადახდები, ფაილები.</p>
                <ConfirmButton title="შეკვეთის წაშლა" description="შეკვეთა, კომენტარები, გადახდები და ფაილები სამუდამოდ წაიშლება." confirmLabel={t.common.delete} action={deleteOrder.bind(null, order.id)} redirectTo="/orders">
                  <Trash2 className="size-3.5" /> {t.common.delete}
                </ConfirmButton>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
