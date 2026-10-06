import { executorProgress, managerProgress } from "@/lib/workflow-view";
import { CLIENT_MAIL_LABELS, type ClientMailKind } from "@/lib/client-mail-content";
import { QuickPriority } from "@/components/app/order-detail/priority";
import { ColleagueAdd } from "@/components/app/order-detail/requests";
import { assigneeStage } from "@/lib/team-flow";
import { OrderManager } from "@/components/app/order-detail/manager";
import { Building2, CalendarClock, CalendarDays, Mail, MapPin, Pencil, Phone, ShieldCheck, Trash2, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteOrder } from "@/actions/orders";
import { OverdueBadge, PriorityLabel, StatusBadge, SystemBadge, TypeBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MapView } from "@/components/app/map-switch";
import { AssigneesEditor } from "@/components/app/order-detail/assignees-editor";
import { DocumentsMenu } from "@/components/app/order-detail/documents-menu";
import { Attachments } from "@/components/app/order-detail/attachments";
import { Comments } from "@/components/app/order-detail/comments";
import { MarkSeen } from "@/components/app/order-detail/mark-seen";
import { OrderHistory, type HistoryEntry } from "@/components/app/order-detail/history";
import { Materials } from "@/components/app/order-detail/materials";
import { OrderServices } from "@/components/app/order-detail/services";
import { Payments } from "@/components/app/order-detail/payments";
import { Checklist } from "@/components/app/order-detail/checklist";
import { StatusActions } from "@/components/app/order-detail/status-actions";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHODS } from "@/lib/finance";
import { PRIORITY_LABELS, EVENT_LABELS, PAYMENT_LABELS, STATUS_LABELS, formatDate, formatDuration, formatMoney, t } from "@/lib/i18n";
import { listActiveServices } from "@/lib/services";
import { getOrderForUser, listAssignableUsers, plannedMinutesByUser } from "@/lib/orders";
import { AssignDialog } from "@/components/app/assign-form";
import { getWorkHoursPerDay, clientEmailsEnabled } from "@/lib/settings";
import { compareNames, isOverdue, orderContact, telHref } from "@/lib/order-utils";
import { plannedEnd, tbilisiTime, tbilisiToday } from "@/lib/schedule-utils";
import { isStaff, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return { title: `შეკვეთა ${id}` };
}

/** Events that only repeat what the screen already shows, or belong to a retired feature. */
const HIDDEN_EVENTS = new Set(["visit_started", "visit_ended", "checklist_done", "checklist_changed", "seen"]);

function eventText(type: string, data: Record<string, unknown> | null) {
  if (type === "manager_changed") return `პასუხისმგებელი შეიცვალა: ${data?.from ?? "არავინ"} → ${data?.to}`;
  if (type === "priority_changed") return `პრიორიტეტი: ${PRIORITY_LABELS[data?.from as keyof typeof PRIORITY_LABELS]} → ${PRIORITY_LABELS[data?.to as keyof typeof PRIORITY_LABELS]}`;
  if (type === "client_email") {
    const parts = [CLIENT_MAIL_LABELS[data?.kind as ClientMailKind], Array.isArray(data?.to) ? data.to.join(", ") : "", data?.skipped ?? data?.error].map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean);
    return `${data?.ok ? "კლიენტს გაეგზავნა" : data?.skipped ? "კლიენტის მეილი გამოტოვებულია" : "კლიენტის მეილი ვერ გაიგზავნა"}${parts.length ? `: ${parts.join(" · ")}` : ""}`;
  }
  const base = EVENT_LABELS[type] ?? type;
  const st = (v: unknown) => STATUS_LABELS[v as keyof typeof STATUS_LABELS] ?? String(v);
  if ((type === "status_changed" || type === "reopened" || type === "verified_closed") && data) return `${base}: ${st(data.from)} → ${st(data.to)}`;
  if (type === "payment_changed" && data) return `${base}: ${PAYMENT_LABELS[data.from as keyof typeof PAYMENT_LABELS] ?? data.from} → ${PAYMENT_LABELS[data.to as keyof typeof PAYMENT_LABELS] ?? data.to}`;
  if (type === "payment_added" && data) return `${base}: ${formatMoney(data.amount as number)} (${PAYMENT_METHODS[String(data.method)] ?? data.method})${data.status ? ` → ${PAYMENT_LABELS[data.status as keyof typeof PAYMENT_LABELS]}` : ""}`;
  if (type === "payment_removed" && data) return `${base}: ${formatMoney(data.amount as number)}`;
  if ((type === "assigned" || type === "self_assigned" || type === "unassigned") && Array.isArray(data?.users)) return `${base}: ${(data!.users as string[]).join(", ")}`;
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
  const [users, plannedToday, normHours, catalogue] = await Promise.all([listAssignableUsers(), staff ? plannedMinutesByUser(tbilisiToday()) : Promise.resolve({} as Record<string, number>), getWorkHoursPerDay(), listActiveServices()]);
  const executorOptions = users.filter((u) => u.role === "executor").map((u) => ({ id: u.id, name: u.name, image: u.image, specializations: u.specializations ?? [], hours: Math.round(((plannedToday[u.id] ?? 0) / 60) * 10) / 10 }));
  const colleagueCandidates = users
    .filter(u => u.role === "executor" && u.id !== me.id && !order.assignees.some(a => a.userId === u.id))
    .map(u => ({ id: u.id, name: u.name }))
    .sort((a, b) => compareNames(a.name, b.name));
  const emailsEnabled = staff ? await clientEmailsEnabled() : false;
  const overdue = isOverdue(order);
  const workOpen = order.status === "new" || order.status === "assigned" || order.status === "in_progress";
  const contact = orderContact(order);
  const siteCoords = order.site?.lat && order.site?.lng ? { lat: Number(order.site.lat), lng: Number(order.site.lng) } : null;
  const address = order.address ?? order.site?.address ?? null;
  const requiredLeft = order.checklist.filter(item => item.required && !item.done).length;
  const plannedEndAt = order.scheduledAt ? plannedEnd(order.scheduledAt, order.plannedMinutes) : null;

  // one line per change: consecutive identical entries by the same person collapse
  const history: HistoryEntry[] = [];
  for (const e of order.events) {
    if (HIDDEN_EVENTS.has(e.type)) continue;
    const text = eventText(e.type, e.data as Record<string, unknown> | null);
    const who = e.user?.name ?? "სისტემა";
    const last = history[history.length - 1];
    if (last && last.text === text && last.who === who && Math.abs(last.at.getTime() - e.createdAt.getTime()) < 120000) {
      last.count += 1;
      continue;
    }
    history.push({ id: e.id, text, who, at: e.createdAt, count: 1 });
  }

  return (
    // extra bottom room on a phone: the action bar floats above the bottom navigation
    <div className="space-y-4 pb-[152px] md:pb-0">
      {!staff && <MarkSeen orderId={order.id} />}

      {staff && !readOnly && <QuickPriority id={order.id} value={order.priority} />}
      {staff && <OrderManager id={order.id} manager={order.manager} at={order.managerAt} me={me.id} />}
      {/* Summary header: status, people, place, time, next action */}
      <div className="ln-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 md:min-w-[480px]">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 md:mb-1.5 md:gap-2">
              <span className="font-mono text-[11px] text-muted-foreground md:text-sm">{order.number}</span>
              <StatusBadge status={order.status} />
              <TypeBadge type={order.type} />
              <SystemBadge system={order.systemType} className="order-last max-w-full whitespace-normal break-words md:order-none md:whitespace-nowrap" />
              <PriorityLabel priority={order.priority} />
              {overdue && <OverdueBadge />}
              {!order.triaged && <span className="rounded-md bg-[#3457d5] px-2 py-0.5 text-xs font-medium text-white">დაუმუშავებელი შეკვეთა</span>}
            </div>
            <h1 className="font-heading text-[20px] leading-snug break-words tracking-[-0.3px] md:text-[24px]">{order.title}</h1>
            <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2 sm:text-sm xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t.order.client} / {t.order.site}</dt>
                  <dd className="font-medium">
                    {order.client ? (staff ? <Link href={`/clients/${order.client.id}`} className="ln-link">{order.client.name}</Link> : order.client.name) : "—"}
                    {order.site ? <span className="text-muted-foreground"> · {order.site.name}</span> : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t.order.scheduledAt}</dt>
                  <dd className="font-medium">
                    <span className="whitespace-nowrap">{order.scheduledAt ? `${formatDate(order.scheduledAt, true)}${plannedEndAt ? ` – ${tbilisiTime(plannedEndAt)}` : ""}` : "დაუგეგმავი"}</span>
                    {order.plannedMinutes ? <span className="whitespace-nowrap text-xs text-muted-foreground"> · {formatDuration(order.plannedMinutes)}</span> : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t.order.dueDate}</dt>
                  <dd className="font-medium">{formatDate(order.dueDate)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t.order.assignees}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5 font-medium">
                    {order.assignees.length === 0 && <span className="text-[#b13f32]">{t.order.unassigned}</span>}
                    {order.assignees.map((a) => (
                      <span key={a.userId} className="inline-flex items-center gap-1 whitespace-nowrap">
                        <UserAvatar name={a.user.name} image={a.user.image} size="xs" /> {a.user.name.split(" ")[0]} · {assigneeStage(a, order.visits)}
                      </span>
                    ))}
                    {staff && !readOnly && !order.triaged && (
                      <span className="text-[13px] font-normal text-muted-foreground">
                        დანიშვნამდე შეკვეთა დაამუშავეთ („<Link href={`/orders/${order.id}/edit`} className="ln-link">დამუშავება</Link>“)
                      </span>
                    )}
                    {/* one control per state: nobody yet → assign with a time; a team already → change it; finished work → neither */}
                    {staff && !readOnly && order.triaged && workOpen && order.assignees.length > 0 && <AssigneesEditor orderId={order.id} users={users} selected={order.assignees.map((a) => a.userId)} />}
                    {staff && !readOnly && order.triaged && workOpen && order.assignees.length === 0 && (
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
          <div className="flex w-full items-center gap-2 sm:w-auto md:justify-end">
            <DocumentsMenu
              className="h-11 flex-1 md:h-8 md:flex-none"
              items={[
                { kind: "sheet" as const, href: `/orders/${order.id}/sheet`, label: "სამუშაო ფურცელი", newTab: true },
                ...(staff && (order.status === "done" || order.status === "closed")
                  ? [
                      { kind: "act" as const, href: `/orders/${order.id}/act`, label: "მიღება-ჩაბარების აქტი", newTab: true },
                      { kind: "invoice" as const, href: `/orders/${order.id}/invoice`, label: "ინვოისი", newTab: true },
                    ]
                  : []),
                ...(staff ? [{ kind: "mail" as const, href: `/orders/${order.id}/mail-preview`, label: "კლიენტის მეილები" }] : []),
              ]}
            />
            {staff && !readOnly && (
              <Button render={<Link href={`/orders/${order.id}/edit`} />} variant="outline" size="sm" className="h-11 flex-1 md:h-8 md:flex-none">
                <Pencil className="size-3.5" /> {t.common.edit}
              </Button>
            )}
          </div>
        </div>
      </div>

      {staff && order.status === "done" && <section className="ln-card p-4 space-y-3"><h2 className="font-heading">შემოწმება</h2><ul className="divide-y">{order.assignees.map(a => <li className="py-2 text-[13px]" key={a.userId}><strong>{a.user.name}</strong><p className="whitespace-pre-wrap">{a.doneNote ?? "ჩაბარების შენიშვნა არ არის"}</p></li>)}</ul><ul className="text-[13px]">{order.items.filter(i => i.creator?.role === "executor").map(i => <li key={i.id}>{i.name} · დაამატა: {i.creator?.name} · {formatMoney(Number(i.quantity) * Number(i.unitPrice))}</li>)}</ul><p>ჯამი: {formatMoney(order.amount)}</p></section>}
      {me.role === "executor" && isAssignee && ["assigned", "in_progress"].includes(order.status) && <ColleagueAdd orderId={order.id} candidates={colleagueCandidates} />}
      <section aria-label="სამუშაოს მიმდინარე ეტაპი" className="border-y border-[#e6ebf2] py-4">
        <h2 className="font-heading text-[16px]">{(staff ? managerProgress(order) : executorProgress(order, me.id)).title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{(staff ? managerProgress(order) : executorProgress(order, me.id)).detail}</p>
        {order.assignees.length > 0 && <p className="mt-2 text-[13px] font-medium">გუნდში ჩაბარებულია: {order.assignees.filter(a => a.doneAt).length} / {order.assignees.length}</p>}
      </section>
      <StatusActions emailsEnabled={emailsEnabled} doneByMe={Boolean(order.assignees.find(a => a.userId === me.id)?.doneAt)} startedByMe={order.visits.some(v => v.userId === me.id && !v.endedAt)} orderId={order.id} status={order.status} role={me.role} isAssignee={isAssignee} requiredLeft={requiredLeft} />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Work first, money after it: the technician never needs the finance block. */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>სამუშაო</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.source === "email" && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {order.emailFrom}
                  </span>
                  {order.emailSubject && <span>თემა: {order.emailSubject}</span>}
                  <span>{formatDate(order.emailReceivedAt ?? order.createdAt, true)}</span>
                </div>
              )}
              {order.description ? <pre className="whitespace-pre-wrap max-md:break-words font-sans text-sm leading-relaxed">{order.description}</pre> : <p className="text-sm text-muted-foreground">აღწერა არ არის</p>}
              {order.completionNote && (
                <div className="rounded-lg border border-[#25815a]/20 bg-[#eaf6ef] p-3 text-sm dark:bg-emerald-950/20">
                  <div className="mb-0.5 text-xs font-medium text-[#25815a]">შესრულებული სამუშაო (ჩაბარებისას)</div>
                  <pre className="whitespace-pre-wrap max-md:break-words font-sans">{order.completionNote}</pre>
                </div>
              )}
              {order.status === "closed" && order.verifier && (
                <p className="text-xs text-muted-foreground">
                  შემოწმდა და დაიხურა: {order.verifier.name} · {formatDate(order.verifiedAt, true)}
                </p>
              )}
            </CardContent>
          </Card>


          {<OrderServices financeVisible={staff} executorId={staff ? undefined : me.id} orderId={order.id} orderSystemType={order.systemType} items={order.items} catalogue={staff ? catalogue : catalogue.map((service) => ({ ...service, price: null }))} readOnly={readOnly || (!staff && !["assigned", "in_progress"].includes(order.status))} vatPercent={order.vatPercent} />}

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

          <Materials orderId={order.id} materials={order.materials} financeVisible={financeVisible} meId={me.id} amount={order.amount} readOnly={readOnly} />

          <Checklist orderId={order.id} items={order.checklist} staff={staff} readOnly={readOnly || order.status === "done" || (!staff && Boolean(order.assignees.find(a => a.userId === me.id)?.doneAt))} />

          <Attachments orderId={order.id} attachments={order.attachments} canDelete={staff && !readOnly} />
          <Comments orderId={order.id} comments={order.comments} meId={me.id} />

        </div>

        {/* Side column: reference material, so it follows the work on a phone */}
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
                      className="ln-link text-xs"
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
                  <div className="min-w-0">
                    <div className="font-medium">
                      {contact.name}
                      {contact.namedOnSite && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">ობიექტზე</span>}
                    </div>
                    {contact.phone ? (
                      <a href={telHref(contact.phone)!} className="ln-link text-xs">
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">ტელეფონი არ არის</span>
                    )}
                    {contact.onSite && order.client.phone && order.client.phone !== contact.phone && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        ოფისი{" "}
                        <a href={telHref(order.client.phone)!} className="ln-link">
                          {order.client.phone}
                        </a>
                      </div>
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
                          <a href={`tel:${a.user.phone.replace(/\s+/g, "")}`} className="ln-link text-xs">
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
              <OrderHistory entries={history} />
            </CardContent>
          </Card>

          {me.role === "admin" && (
            <Card className="ring-1 ring-[#f0c9c3]">
              <CardHeader className="pb-1">
                <CardTitle className="text-[#b13f32]">საშიში მოქმედებები</CardTitle>
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
