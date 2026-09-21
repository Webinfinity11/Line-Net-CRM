import { inArray } from "drizzle-orm";
import { Building2, Inbox, Mail, Paperclip } from "lucide-react";
import Link from "next/link";
import { setStatus } from "@/actions/orders";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MailSyncStatus } from "@/components/app/mail-sync-status";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { orderAttachments } from "@/db/schema";
import { getMailSyncState } from "@/lib/graph-mail";
import { formatDate, t } from "@/lib/i18n";
import { listOrders } from "@/lib/orders";
import { outlookMessages, type OutlookErrorCode } from "@/lib/outlook-oauth";
import { requireUser } from "@/lib/session";

export const metadata = { title: "შემოსულები" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const user = await requireUser(["admin", "manager"]);
  const params = await searchParams;
  const outcome = typeof params.outlook === "string" ? params.outlook : "";
  const connectionError = Object.hasOwn(outlookMessages, outcome) ? outlookMessages[outcome as OutlookErrorCode] : null;
  const [items, mailState] = await Promise.all([listOrders({ inbox: true }, { limit: 200 }), getMailSyncState()]);
  const ids = items.map((i) => i.id);
  const files = ids.length ? await db.select({ orderId: orderAttachments.orderId }).from(orderAttachments).where(inArray(orderAttachments.orderId, ids)) : [];
  const fileCount = new Map<number, number>();
  for (const f of files) fileCount.set(f.orderId, (fileCount.get(f.orderId) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <PageHeader title={t.nav.inbox} subtitle={items.length ? `${items.length} დაუმუშავებელი მოთხოვნა` : "ელფოსტიდან და კლიენტის კაბინეტიდან შემოსული შეკვეთები"} />

      {outcome === "connected" && (
        <p role="status" className="ln-card p-4 text-[12.5px] text-[#25815a]">
          Outlook ფოსტა დაკავშირებულია. ახალი წერილები გამოჩნდება შემდეგი შემოწმებისას.
        </p>
      )}
      {connectionError && (
        <p role="alert" className="ln-card p-4 text-[12.5px] text-[#b13f32]">
          {connectionError}
        </p>
      )}

      <MailSyncStatus state={mailState} canManage={user.role === "admin"} />

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          message="დაუმუშავებელი მოთხოვნები არ არის. ფოსტიდან და კლიენტის კაბინეტიდან შემოსული შეკვეთა აქ გამოჩნდება, სანამ მენეჯერი არ დაამუშავებს."
          className="ln-card border-transparent py-16 max-md:py-8"
        />
      ) : (
        <ul className="ln-enter ln-enter-2 space-y-2">
          {items.map((o) => {
            const portal = o.source === "portal";
            const SourceIcon = portal ? Building2 : Mail;
            return (
            <li key={o.id} className="ln-card flex flex-wrap items-start gap-4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef2ff] text-[#3457d5]" title={portal ? "კლიენტის კაბინეტიდან" : "ელფოსტიდან"}>
                <SourceIcon className="size-[18px] [stroke-width:1.7]" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/orders/${o.id}`} className="block truncate max-md:whitespace-normal max-md:break-words text-[14px] font-medium hover:text-[#3457d5]">
                  {portal ? o.title : (o.emailSubject ?? o.title)}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="truncate max-md:whitespace-normal max-md:break-all">{portal ? `კაბინეტიდან · ${o.client?.name ?? ""}` : o.emailFrom}</span>
                  {portal && o.priority === "urgent" && <span className="font-medium text-[#b13f32]">სასწრაფო</span>}
                  <span className="tabular">{formatDate(o.emailReceivedAt ?? o.createdAt, true)}</span>
                  {fileCount.get(o.id) ? (
                    <span className="flex items-center gap-1">
                      <Paperclip className="size-3 [stroke-width:1.7]" /> {fileCount.get(o.id)}
                    </span>
                  ) : null}
                </div>
                {o.description && <p className="mt-2 line-clamp-2 text-[12.5px] text-[#617084]">{o.description}</p>}
              </div>
              <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                <Button render={<Link href={`/orders/${o.id}/edit`} />} size="sm" className="h-11 flex-1 sm:h-8 sm:flex-none">
                  დამუშავება
                </Button>
                <ConfirmButton
                  title={portal ? "მოთხოვნის გაუქმება" : "წერილის გაუქმება"}
                  description="შეკვეთა გადავა „გაუქმებული“ სტატუსში და შემოსულებიდან წაიშლება."
                  confirmLabel={portal ? "მოთხოვნის გაუქმება" : "შეკვეთის გაუქმება"}
                  variant="outline"
                  size="sm"
                  className="h-11 flex-1 sm:h-8 sm:flex-none"
                  action={setStatus.bind(null, o.id, "cancelled")}
                >
                  არ არის შეკვეთა
                </ConfirmButton>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
