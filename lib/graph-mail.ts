import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mailSync } from "@/db/schema";
import { createOrderFromEmail, type InboundAttachment } from "@/lib/inbound-email";

/**
 * Polls a Microsoft 365 mailbox through Microsoft Graph (application permissions: Mail.Read)
 * and creates untriaged orders for new messages. Idempotent on internetMessageId.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export function graphConfig() {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const mailbox = process.env.GRAPH_MAILBOX;
  if (!tenantId || !clientId || !clientSecret || !mailbox) return null;
  return { tenantId, clientId, clientSecret, mailbox };
}

export const isGraphConfigured = () => graphConfig() !== null;

async function getToken(cfg: NonNullable<ReturnType<typeof graphConfig>>) {
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
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
  size?: number;
  contentBytes?: string;
  isInline?: boolean;
};

export type PollResult = { ok: true; fetched: number; created: number; skipped: number } | { ok: false; error: string };

export async function pollMailbox(): Promise<PollResult> {
  const cfg = graphConfig();
  if (!cfg) return { ok: false, error: "Microsoft Graph არ არის კონფიგურირებული (GRAPH_* გარემოს ცვლადები)" };

  const [state] = await db.select().from(mailSync).where(eq(mailSync.mailbox, cfg.mailbox));
  // First run: only look back 7 days so we do not import the whole history.
  const since = state?.lastReceivedAt ?? new Date(Date.now() - 7 * 24 * 3600 * 1000);

  try {
    const token = await getToken(cfg);
    const headers = { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' };
    const params = new URLSearchParams({
      $filter: `receivedDateTime gt ${since.toISOString()}`,
      $orderby: "receivedDateTime asc",
      $top: "50",
      $select: "id,internetMessageId,subject,receivedDateTime,hasAttachments,from,body,bodyPreview",
    });
    const res = await fetch(`${GRAPH}/users/${encodeURIComponent(cfg.mailbox)}/mailFolders/inbox/messages?${params}`, { headers });
    if (!res.ok) throw new Error(`messages: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { value: GraphMessage[] };

    let created = 0;
    let skipped = 0;
    let latest = since;
    for (const m of data.value) {
      const received = new Date(m.receivedDateTime);
      if (received > latest) latest = received;
      const attachments: InboundAttachment[] = [];
      if (m.hasAttachments) {
        const ar = await fetch(`${GRAPH}/users/${encodeURIComponent(cfg.mailbox)}/messages/${m.id}/attachments?$select=id,name,contentType,size,contentBytes,isInline`, { headers });
        if (ar.ok) {
          const aj = (await ar.json()) as { value: GraphAttachment[] };
          for (const a of aj.value) {
            if (a["@odata.type"] === "#microsoft.graph.fileAttachment" && a.contentBytes && !a.isInline) {
              attachments.push({ fileName: a.name, contentType: a.contentType ?? null, contentBase64: a.contentBytes });
            }
          }
        }
      }
      const isHtml = m.body?.contentType === "html";
      const id = await createOrderFromEmail({
        messageId: m.internetMessageId || `graph:${m.id}`,
        from: m.from?.emailAddress?.address ?? "unknown",
        fromName: m.from?.emailAddress?.name ?? null,
        subject: m.subject ?? "",
        text: isHtml ? null : (m.body?.content ?? m.bodyPreview ?? null),
        html: isHtml ? m.body?.content : null,
        receivedAt: received,
        attachments,
      });
      if (id === null) skipped++;
      else created++;
    }

    await db
      .insert(mailSync)
      .values({ mailbox: cfg.mailbox, lastReceivedAt: latest, lastRunAt: new Date(), lastError: null })
      .onConflictDoUpdate({ target: mailSync.mailbox, set: { lastReceivedAt: latest, lastRunAt: new Date(), lastError: null } });

    return { ok: true, fetched: data.value.length, created, skipped };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db
      .insert(mailSync)
      .values({ mailbox: cfg.mailbox, lastRunAt: new Date(), lastError: error })
      .onConflictDoUpdate({ target: mailSync.mailbox, set: { lastRunAt: new Date(), lastError: error } });
    return { ok: false, error };
  }
}

export async function getMailSyncState() {
  const cfg = graphConfig();
  if (!cfg) return { configured: false as const };
  const [state] = await db.select().from(mailSync).where(eq(mailSync.mailbox, cfg.mailbox));
  return { configured: true as const, mailbox: cfg.mailbox, lastRunAt: state?.lastRunAt ?? null, lastError: state?.lastError ?? null };
}
