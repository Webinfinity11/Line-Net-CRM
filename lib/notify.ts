import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { notifications, user } from "@/db/schema";

export type NotifyInput = { type: string; title: string; body?: string | null; orderId?: number | null };

const APP_URL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendEmail(to: string[], subject: string, text: string, link?: string) {
  if (!smtpConfigured() || to.length === 0) return false;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.join(", "),
      subject: `[Line Net CRM] ${subject}`,
      text: link ? `${text}\n\n${link}` : text,
    });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}

/** Creates in-app notifications for the given users and emails them when SMTP is configured. */
export async function notifyUsers(userIds: string[], n: NotifyInput, opts: { excludeUserId?: string | null; email?: boolean; tx?: Pick<typeof db, "insert" | "select" | "update"> } = {}) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== opts.excludeUserId);
  if (ids.length === 0) return;
  const connection = opts.tx ?? db;
  const rows = await connection
    .insert(notifications)
    .values(ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? null, orderId: n.orderId ?? null })))
    .returning({ id: notifications.id, userId: notifications.userId });

  if (opts.email !== false && smtpConfigured()) {
    const recipients = await db.select({ id: user.id, email: user.email }).from(user).where(and(inArray(user.id, ids), eq(user.banned, false), ne(user.role, "client")));
    const link = n.orderId ? `${APP_URL}/orders/${n.orderId}` : APP_URL;
    const ok = await sendEmail(
      recipients.map((r) => r.email),
      n.title,
      n.body ?? n.title,
      link,
    );
    if (ok) {
      await db
        .update(notifications)
        .set({ emailedAt: new Date() })
        .where(inArray(notifications.id, rows.filter(r => recipients.some(u => u.id === r.userId)).map((r) => r.id)));
    }
  }
}

/** All active admins and managers */
export async function staffUserIds(): Promise<string[]> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.role, ["admin", "manager"]), eq(user.banned, false)));
  return rows.map((r) => r.id);
}

export async function getUnreadCount(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Orders where this user has an unread chat message (the row type the chat writes). */
export async function unreadCommentOrderIds(userId: string): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ orderId: notifications.orderId })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, "comment"), isNull(notifications.readAt), isNotNull(notifications.orderId)));
  return new Set(rows.flatMap((r) => (r.orderId === null ? [] : [r.orderId])));
}

export async function listNotifications(userId: string, limit = 50) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
    with: { order: { columns: { id: true, number: true, title: true } } },
  });
}

export async function sendSmtpMessage(message: { to: string[]; subject: string; text: string; html: string; inReplyTo?: string; references?: string }) {
 const nodemailer = (await import("nodemailer")).default;
 const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: Number(process.env.SMTP_PORT ?? 587) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
 await transport.sendMail({ ...message, from: process.env.SMTP_FROM || process.env.SMTP_USER });
}
