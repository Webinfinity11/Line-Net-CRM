import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, orderEvents, orders, outlookConnection } from "@/db/schema";
import { clientEmailsEnabled, getCompanySettings } from "./settings";
import { clientMailRecipients, renderClientMail, type ClientMailKind } from "./client-mail-content";
import { getOutlookAccessToken, MAIL_LOCK_ID } from "./outlook-connection";
import { GRAPH_URL, graphJson } from "./outlook-oauth";
import { smtpConfigured, sendSmtpMessage } from "./notify";
export async function previewClientMail(orderId: number, kind: ClientMailKind) {
 const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { client: true, site: { with: { contacts: true } }, items: true } });
 if (!o) return null;
 return { ...renderClientMail(kind, o, await getCompanySettings()), to: clientMailRecipients(o), emailMessageId: o.source === "email" ? o.emailMessageId : null };
}
// Called only after authorized staff mutations. Disabled means no transport/token calls.
export async function sendClientMail(orderId: number, kind: ClientMailKind, userId: string) {
 const log = async (data: Record<string, unknown>) => { await db.insert(orderEvents).values({ orderId, userId, type: "client_email", data: { kind, to: [], ok: false, ...data } }); };
 if (process.env.CLIENT_MAIL_DRY_RUN === "1" || !await clientEmailsEnabled()) { await log({ skipped: "მეილები გამორთულია" }); return; }
 const mail = await previewClientMail(orderId, kind);
 if (!mail?.to.length) { await log({ skipped: "მიმღები არ არის" }); return; }
 try {
  const token = await db.transaction(async tx => {
   await tx.execute(sql`select pg_advisory_xact_lock(${MAIL_LOCK_ID})`);
   const connection = await tx.query.outlookConnection.findFirst({ where: eq(outlookConnection.id, "shared") });
   const scope = await tx.query.appSettings.findFirst({ where: eq(appSettings.key, "outlook_granted_scope") });
   if (!connection || !String(scope?.value ?? "").split(/\s+/).some(s => s === "Mail.Send" || s.endsWith("/Mail.Send"))) return null;
   return getOutlookAccessToken(tx, connection);
  });
  // Recheck immediately before outbound work, including the explicit local no-send guard.
  if (process.env.CLIENT_MAIL_DRY_RUN === "1" || !await clientEmailsEnabled()) { await log({ to: mail.to, skipped: "გაგზავნა გამორთულია" }); return; }
  if (token) {
   let endpoint = `${GRAPH_URL}/me/sendMail`;
   const message = { subject: mail.subject, body: { contentType: "HTML", content: mail.html }, toRecipients: mail.to.map(address => ({ emailAddress: { address } })) };
   let body: object = { message, saveToSentItems: true };
   if (mail.emailMessageId) {
    let graphId: string | undefined;
    if (mail.emailMessageId.startsWith("graph:")) graphId = mail.emailMessageId.split(":").slice(2).join(":");
    else {
     const query = new URLSearchParams({ $filter: `internetMessageId eq '${mail.emailMessageId.replace(/'/g, "''")}'`, $select: "id", $top: "1" });
     const found = await graphJson<{ value: { id: string }[] }>(`${GRAPH_URL}/me/messages?${query}`, token);
     graphId = found.value[0]?.id;
    }
    if (!graphId) { await log({ to: mail.to, skipped: "საწყისი წერილი ვერ მოიძებნა" }); return; }
    endpoint = `${GRAPH_URL}/me/messages/${encodeURIComponent(graphId)}/reply`;
    body = { message: { body: message.body, toRecipients: message.toRecipients } };
   }
   const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20000) });
   if (!response.ok) throw new Error(`Graph HTTP ${response.status}`);
   await log({ to: mail.to, ok: true, transport: "graph" }); return;
  }
  if (!smtpConfigured()) { await log({ to: mail.to, skipped: "გაგზავნის არხი არ არის გამართული" }); return; }
  if (mail.emailMessageId?.startsWith("graph:")) { await log({ to: mail.to, skipped: "SMTP პასუხისთვის საწყისი Message-ID არ არის" }); return; }
  const thread = mail.emailMessageId && !mail.emailMessageId.startsWith("graph:") ? mail.emailMessageId : undefined;
  await sendSmtpMessage({ to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, inReplyTo: thread, references: thread });
  await log({ to: mail.to, ok: true, transport: "smtp" });
 } catch (e) { await log({ to: mail.to, error: e instanceof Error ? e.message : "გაგზავნა ვერ მოხერხდა" }); }
}
