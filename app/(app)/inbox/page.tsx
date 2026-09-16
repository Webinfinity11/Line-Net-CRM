import { Inbox, Mail, Paperclip } from "lucide-react";
import Link from "next/link";
import { setStatus } from "@/actions/orders";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MailSyncStatus } from "@/components/app/mail-sync-status";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, t } from "@/lib/i18n";
import { getMailSyncState } from "@/lib/graph-mail";
import { listOrders } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { db } from "@/db";
import { orderAttachments } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const metadata = { title: "შემოსულები" };

export default async function InboxPage() {
  await requireUser(["admin", "manager"]);
  const [items, mailState] = await Promise.all([listOrders({ inbox: true }, { limit: 200 }), getMailSyncState()]);
  const ids = items.map((i) => i.id);
  const files = ids.length ? await db.select({ orderId: orderAttachments.orderId }).from(orderAttachments).where(inArray(orderAttachments.orderId, ids)) : [];
  const fileCount = new Map<number, number>();
  for (const f of files) fileCount.set(f.orderId, (fileCount.get(f.orderId) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title={t.nav.inbox}
        subtitle="ელფოსტიდან ავტომატურად შექმნილი შეკვეთები. დაამუშავეთ: შეავსეთ კლიენტი, ობიექტი და დანიშნეთ შემსრულებელი."
        actions={<MailSyncStatus state={mailState} />}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center dark:bg-neutral-900">
          <Inbox className="mb-3 size-10 text-neutral-300" />
          <p className="text-sm text-muted-foreground">დაუმუშავებელი წერილები არ არის</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id} className="flex flex-wrap items-start gap-3 rounded-xl border bg-white p-4 dark:bg-neutral-900">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40">
                <Mail className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/orders/${o.id}`} className="block truncate text-base font-medium hover:text-sky-700">
                  {o.emailSubject ?? o.title}
                </Link>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{o.emailFrom}</span>
                  <span>{formatDate(o.emailReceivedAt ?? o.createdAt, true)}</span>
                  {fileCount.get(o.id) ? (
                    <span className="flex items-center gap-1">
                      <Paperclip className="size-3" /> {fileCount.get(o.id)}
                    </span>
                  ) : null}
                </div>
                {o.description && <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">{o.description}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button render={<Link href={`/orders/${o.id}/edit`} />} size="sm" className="bg-sky-600 hover:bg-sky-700">
                  დამუშავება
                </Button>
                <ConfirmButton
                  title="წერილის გაუქმება"
                  description="შეკვეთა გადავა „გაუქმებული“ სტატუსში და შემოსულებიდან წაიშლება."
                  confirmLabel="გაუქმება"
                  variant="outline"
                  action={setStatus.bind(null, o.id, "cancelled")}
                >
                  არ არის შეკვეთა
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
