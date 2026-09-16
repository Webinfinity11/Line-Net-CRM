import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mailSync, outlookConnection } from "@/db/schema";
import { decryptMailSecret, encryptMailSecret, GRAPH_URL, graphJson, OutlookError, outlookConfig, requestOutlookToken } from "@/lib/outlook-oauth";

export type MailTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Serialize sync, token rotation, reconnect and disconnect across server processes.
export const MAIL_LOCK_ID = 71603251;

export async function saveOutlookConnection(code: string, verifier: string, userId: string) {
  const cfg = outlookConfig();
  if (!cfg) throw new OutlookError("setup");
  const tokens = await requestOutlookToken({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: cfg.redirectUri });
  if (!tokens.refresh_token) throw new OutlookError("permission");
  const profile = await graphJson<{ id: string; mail?: string; userPrincipalName?: string }>(`${GRAPH_URL}/me?$select=id,mail,userPrincipalName`, tokens.access_token);
  const mailbox = (profile.mail || profile.userPrincipalName || "").trim().toLowerCase();
  if (!profile.id || !mailbox.includes("@")) throw new OutlookError("mailbox");
  // A Microsoft identity (e.g. a Gmail sign-in) need not have an Outlook mailbox.
  await graphJson(`${GRAPH_URL}/me/mailFolders/inbox/messages?$top=1&$select=id`, tokens.access_token);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MAIL_LOCK_ID})`);
    const [existing] = await tx.select().from(outlookConnection).where(eq(outlookConnection.id, "shared"));
    if (existing && existing.accountId !== profile.id) throw new OutlookError("different");
    const values = {
      id: "shared", accountId: profile.id, mailbox,
      accessToken: encryptMailSecret(tokens.access_token), refreshToken: encryptMailSecret(tokens.refresh_token!),
      expiresAt: new Date(now.getTime() + tokens.expires_in * 1000), connectedBy: userId,
    };
    await tx.insert(outlookConnection).values(values).onConflictDoUpdate({ target: outlookConnection.id, set: values });
    // First connection imports only future mail. Reconnection resumes the existing cursor.
    await tx.insert(mailSync).values({ mailbox, lastReceivedAt: now }).onConflictDoNothing();
    await tx.update(mailSync).set({ lastError: null }).where(eq(mailSync.mailbox, mailbox));
  });
}

export async function getOutlookAccessToken(tx: MailTransaction, connection: typeof outlookConnection.$inferSelect) {
  try {
    if (connection.expiresAt.getTime() > Date.now() + 60_000) return decryptMailSecret(connection.accessToken);
    const token = await requestOutlookToken({ grant_type: "refresh_token", refresh_token: decryptMailSecret(connection.refreshToken) });
    await tx.update(outlookConnection).set({
      accessToken: encryptMailSecret(token.access_token),
      refreshToken: token.refresh_token ? encryptMailSecret(token.refresh_token) : connection.refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
    }).where(eq(outlookConnection.id, connection.id));
    return token.access_token;
  } catch (error) {
    if (error instanceof OutlookError) throw error;
    throw new OutlookError("reconnect");
  }
}

export async function removeOutlookConnection() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MAIL_LOCK_ID})`);
    await tx.delete(outlookConnection).where(eq(outlookConnection.id, "shared"));
  });
}
