import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderAttachments, orderEvents, orders } from "@/db/schema";
import { notifyUsers, staffUserIds } from "@/lib/notify";
import { saveFile } from "@/lib/storage";

export type InboundAttachment = { fileName: string; contentType?: string | null; contentBase64: string };

export type InboundEmail = {
  messageId: string;
  from: string;
  fromName?: string | null;
  subject: string;
  text?: string | null;
  html?: string | null;
  receivedAt?: Date | null;
  attachments?: InboundAttachment[];
};

/** Rough HTML → text so an email body is readable in the order description. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Creates an untriaged order from an inbound email. Idempotent on messageId.
 * Returns the order id, or null when the message was already imported.
 */
export async function createOrderFromEmail(mail: InboundEmail): Promise<number | null> {
  const existing = await db.query.orders.findFirst({ where: eq(orders.emailMessageId, mail.messageId), columns: { id: true } });
  if (existing) return null;

  const body = (mail.text && mail.text.trim()) || (mail.html ? htmlToText(mail.html) : "");
  const title = (mail.subject || "").trim() || `წერილი: ${mail.from}`;
  const fromLabel = mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from;

  const [row] = await db
    .insert(orders)
    .values({
      title: title.slice(0, 200),
      description: body.slice(0, 10000) || null,
      source: "email",
      triaged: false,
      status: "new",
      emailFrom: fromLabel.slice(0, 300),
      emailSubject: mail.subject?.slice(0, 300) || null,
      emailMessageId: mail.messageId,
      emailReceivedAt: mail.receivedAt ?? new Date(),
    })
    .onConflictDoNothing({ target: orders.emailMessageId })
    .returning({ id: orders.id });
  if (!row) return null;

  await db.insert(orderEvents).values({ orderId: row.id, type: "created_from_email", data: { from: mail.from, subject: mail.subject } });
  await notifyUsers(await staffUserIds(), { type: "email", title: `ახალი წერილი: ${title.slice(0, 80)}`, body: fromLabel, orderId: row.id });

  for (const a of mail.attachments ?? []) {
    try {
      const buf = Buffer.from(a.contentBase64, "base64");
      if (buf.length === 0 || buf.length > 25 * 1024 * 1024) continue;
      const storagePath = await saveFile(`orders/${row.id}`, a.fileName || "attachment", buf);
      await db.insert(orderAttachments).values({
        orderId: row.id,
        fileName: a.fileName || "attachment",
        mimeType: a.contentType ?? null,
        size: buf.length,
        storagePath,
      });
    } catch (e) {
      console.error("attachment import failed", a.fileName, e);
    }
  }
  return row.id;
}
