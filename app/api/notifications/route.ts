import { and, asc, count, eq, exists, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orderAssignees, user } from "@/db/schema";
import { notificationLink } from "@/lib/notification-link";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [person] = await db.select({ role: user.role, banned: user.banned }).from(user).where(eq(user.id, session.user.id));
  if (!person || person.banned) return Response.json({ error: "forbidden" }, { status: 403 });
  const raw = new URL(req.url).searchParams.get("since") ?? "0";
  const since = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(since) || since < 0 || since > 2147483647) {
    return Response.json({ error: "invalid cursor" }, { status: 400 });
  }
  // Assignment can have changed since the notification was created.
  const accessible = person.role === "executor"
    ? or(isNull(notifications.orderId), exists(db.select({ one: sql`1` }).from(orderAssignees).where(and(eq(orderAssignees.orderId, notifications.orderId), eq(orderAssignees.userId, session.user.id)))))
    : undefined;
  const filter = and(eq(notifications.userId, session.user.id), isNull(notifications.readAt), accessible);
  const [items, [total]] = await Promise.all([
    db.select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, orderId: notifications.orderId, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications).where(and(filter, gt(notifications.id, since))).orderBy(asc(notifications.id)).limit(50),
    db.select({ n: count() }).from(notifications).where(filter),
  ]);
  return Response.json({ items: items.map(item => ({ ...item, href: notificationLink(person.role, item) })), unread: total?.n ?? 0, nextSince: items.at(-1)?.id ?? since }, { headers: { "Cache-Control": "private, no-store" } });
}

export const dynamic = "force-dynamic";
