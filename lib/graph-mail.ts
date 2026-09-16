import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mailSync, outlookConnection } from "@/db/schema";
import { createOrderFromEmail, type InboundAttachment } from "@/lib/inbound-email";
import { getOutlookAccessToken, MAIL_LOCK_ID } from "@/lib/outlook-connection";
import { GRAPH_URL, graphJson, OutlookError, outlookConfig, outlookMessages } from "@/lib/outlook-oauth";

export function graphConfig() {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const mailbox = process.env.GRAPH_MAILBOX;
  if (!tenantId || !clientId || !clientSecret || !mailbox) return null;
  return { tenantId, clientId, clientSecret, mailbox };
}

export async function isGraphConfigured() {
  if (graphConfig()) return true;
  const [connection] = await db.select({ id: outlookConnection.id }).from(outlookConnection).where(eq(outlookConnection.id, "shared"));
  return Boolean(connection);
}

async function getApplicationToken(cfg: NonNullable<ReturnType<typeof graphConfig>>) {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new OutlookError("credentials");
  const json = await response.json();
  if (typeof json.access_token !== "string") throw new OutlookError("credentials");
  return json.access_token as string;
}

type GraphMessage = {
  id: string;
  internetMessageId?: string;
  subject?: string;
  receivedDateTime: string;
  hasAttachments?: boolean;
  from?: { emailAddress?: { address?: string; name?: string } };
  body?: { contentType?: "text" | "html"; content?: string };
  bodyPreview?: string;
};
type GraphAttachment = {
  "@odata.type": string;
  id: string;
  name: string;
  contentType?: string;
  contentBytes?: string;
  isInline?: boolean;
};
type GraphPage<T> = { value: T[]; "@odata.nextLink"?: string };
export type PollResult = { ok: true; fetched: number; created: number; skipped: number } | { ok: false; error: string };

/** The delegated Outlook connection takes precedence over the optional business mailbox. */
export async function pollMailbox(): Promise<PollResult> {
  return db.transaction(async (tx): Promise<PollResult> => {
    const lock = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${MAIL_LOCK_ID}) as locked`);
    if (!lock.rows[0]?.locked) return { ok: false, error: "ფოსტა უკვე მოწმდება. სცადეთ ცოტა ხანში." };
    const [connection] = await tx.select().from(outlookConnection).where(eq(outlookConnection.id, "shared"));
    const cfg = graphConfig();
    if (!connection && !cfg) return { ok: false, error: "Outlook ფოსტა ჯერ არ არის დაკავშირებული" };
    const mailbox = connection?.mailbox ?? cfg!.mailbox;
    const [state] = await tx.select().from(mailSync).where(eq(mailSync.mailbox, mailbox));
    const since = state?.lastReceivedAt ?? connection?.connectedAt ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);

    try {
      const token = connection ? await getOutlookAccessToken(tx, connection) : await getApplicationToken(cfg!);
      const base = connection ? `${GRAPH_URL}/me` : `${GRAPH_URL}/users/${encodeURIComponent(mailbox)}`;
      const params = new URLSearchParams({
        // Inclusive boundary + message-id dedup prevents losing messages with identical timestamps.
        $filter: `receivedDateTime ge ${since.toISOString()}`, $orderby: "receivedDateTime asc", $top: "50",
        $select: "id,internetMessageId,subject,receivedDateTime,hasAttachments,from,body,bodyPreview",
      });
      let next: string | undefined = `${base}/mailFolders/inbox/messages?${params}`;
      let fetched = 0;
      let created = 0;
      let skipped = 0;
      let latest = since;
      while (next) {
        const page: GraphPage<GraphMessage> = await graphJson(next, token);
        for (const message of page.value) {
          const received = new Date(message.receivedDateTime);
          if (!Number.isFinite(received.getTime())) throw new OutlookError("failed");
          const attachments: InboundAttachment[] = [];
          if (message.hasAttachments) {
            let attachmentUrl: string | undefined = `${base}/messages/${encodeURIComponent(message.id)}/attachments`;
            while (attachmentUrl) {
              const files: GraphPage<GraphAttachment> = await graphJson(attachmentUrl, token);
              for (const file of files.value) {
                if (file["@odata.type"] === "#microsoft.graph.fileAttachment" && file.contentBytes && !file.isInline) {
                  attachments.push({ fileName: file.name, contentType: file.contentType ?? null, contentBase64: file.contentBytes });
                }
              }
              attachmentUrl = files["@odata.nextLink"];
            }
          }
          const isHtml = message.body?.contentType === "html";
          const id = await createOrderFromEmail({
            messageId: message.internetMessageId || `graph:${mailbox}:${message.id}`,
            from: message.from?.emailAddress?.address ?? "unknown", fromName: message.from?.emailAddress?.name ?? null,
            subject: message.subject ?? "", text: isHtml ? null : (message.body?.content ?? message.bodyPreview ?? null),
            html: isHtml ? message.body?.content : null, receivedAt: received, attachments,
          });
          fetched++;
          if (id === null) skipped++; else created++;
          if (received > latest) latest = received;
        }
        next = page["@odata.nextLink"];
      }
      await tx.insert(mailSync).values({ mailbox, lastReceivedAt: latest, lastRunAt: new Date(), lastError: null })
        .onConflictDoUpdate({ target: mailSync.mailbox, set: { lastReceivedAt: latest, lastRunAt: new Date(), lastError: null } });
      return { ok: true, fetched, created, skipped };
    } catch (error) {
      const message = error instanceof OutlookError ? error.message : outlookMessages.unavailable;
      // Keep the cursor on failure so a later run retries all unprocessed messages.
      await tx.insert(mailSync).values({ mailbox, lastRunAt: new Date(), lastError: message })
        .onConflictDoUpdate({ target: mailSync.mailbox, set: { lastRunAt: new Date(), lastError: message } });
      return { ok: false, error: message };
    }
  });
}

export async function getMailSyncState() {
  const canConnect = Boolean(outlookConfig());
  const automatic = process.env.INTERNAL_CRON !== "0" && process.env.VERCEL !== "1";
  // Explicit projection: credentials must never reach a client component.
  const [connection] = await db.select({ mailbox: outlookConnection.mailbox }).from(outlookConnection).where(eq(outlookConnection.id, "shared"));
  const mailbox = connection?.mailbox ?? graphConfig()?.mailbox;
  if (!mailbox) return { configured: false as const, canConnect, automatic };
  const [state] = await db.select().from(mailSync).where(eq(mailSync.mailbox, mailbox));
  return {
    configured: true as const, canConnect, automatic, mode: connection ? "outlook" as const : "application" as const,
    mailbox, lastRunAt: state?.lastRunAt ?? null, lastError: state?.lastError ?? null,
  };
}

export type MailSyncState = Awaited<ReturnType<typeof getMailSyncState>>;
