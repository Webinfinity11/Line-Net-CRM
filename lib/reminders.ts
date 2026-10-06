import "server-only";
import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders, user } from "@/db/schema";
import { notifyUsers } from "@/lib/notify";
import { tbilisiDayBounds, tbilisiTime, tbilisiToday } from "@/lib/schedule-utils";

export const DONE_WAITING_WITHOUT_DUE_MS = 3 * 24 * 60 * 60 * 1000;

export type ReminderType = "visit_today" | "overdue" | "done_waiting";
type Recipient = { id: string; role: string; banned: boolean };
export type ReminderOrder = Pick<typeof orders.$inferSelect,
  "id" | "number" | "title" | "status" | "triaged" | "scheduledAt" | "dueDate" | "completedAt" | "managerId" | "address"
> & { site: { name: string; address: string | null } | null; assignees: { userId: string }[] };
type Previous = Pick<typeof notifications.$inferSelect, "userId" | "type" | "orderId" | "createdAt">;
export type Reminder = { userId: string; type: ReminderType; title: string; body: string | null; orderId: number };

/** Pure selection shared by the real run and read-only preview. */
export function planReminders(input: ReminderOrder[], people: Recipient[], previous: Previous[], now = new Date()): Reminder[] {
  const today = tbilisiToday(now);
  const { start, end } = tbilisiDayBounds(today);
  const active = new Map(people.filter(p => !p.banned && ["admin", "manager", "executor"].includes(p.role)).map(p => [p.id, p]));
  const staff = people.filter(p => active.has(p.id) && ["admin", "manager"].includes(p.role)).map(p => p.id);
  const key = (userId: string, type: string, orderId: number | null) => JSON.stringify([userId, type, orderId]);
  const seen = new Set(previous.filter(n => n.type !== "visit_today" || (n.createdAt >= start && n.createdAt < end)).map(n => key(n.userId, n.type, n.orderId)));
  const result: Reminder[] = [];
  for (const order of input) {
    const assignees = order.assignees.map(a => a.userId);
    const managers = order.managerId ? staff.filter(id => id === order.managerId) : staff;
    const body = [order.site?.name, order.address || order.site?.address].filter(Boolean).join(" · ") || null;
    const add = (type: ReminderType, title: string, ids: string[]) => {
      for (const userId of ids) {
        const recipient = active.get(userId);
        const k = key(userId, type, order.id);
        if (!recipient || seen.has(k) || (recipient.role === "executor" && !assignees.includes(userId))) continue;
        seen.add(k);
        result.push({ userId, type, title, body, orderId: order.id });
      }
    };
    if (order.triaged && ["assigned", "in_progress"].includes(order.status) && order.scheduledAt && order.scheduledAt >= start && order.scheduledAt < end) {
      add("visit_today", `დღეს ${tbilisiTime(order.scheduledAt)} — ${order.title}`, assignees);
    }
    if (["new", "assigned", "in_progress"].includes(order.status) && order.dueDate && order.dueDate < today) {
      add("overdue", `ვადა გავიდა: ${order.number}`, [...managers, ...assignees]);
    }
    const waitingTooLong = order.dueDate
      ? order.dueDate < today
      : order.completedAt && order.completedAt.getTime() < now.getTime() - DONE_WAITING_WITHOUT_DUE_MS;
    if (order.status === "done" && waitingTooLong) {
      add("done_waiting", `ჩაბარებულია და ელოდება დახურვას: ${order.number}`, managers);
    }
  }
  return result;
}

type Connection = Pick<typeof db, "query" | "select">;
async function collect(connection: Connection, now: Date) {
  const today = tbilisiToday(now);
  const { start, end } = tbilisiDayBounds(today);
  const candidates = await connection.query.orders.findMany({
    columns: { id: true, number: true, title: true, status: true, triaged: true, scheduledAt: true, dueDate: true, completedAt: true, managerId: true, address: true },
    where: or(
      and(eq(orders.triaged, true), inArray(orders.status, ["assigned", "in_progress"]), gte(orders.scheduledAt, start), lt(orders.scheduledAt, end)),
      and(inArray(orders.status, ["new", "assigned", "in_progress"]), lt(orders.dueDate, today)),
      and(eq(orders.status, "done"), or(
        lt(orders.dueDate, today),
        and(isNull(orders.dueDate), lt(orders.completedAt, new Date(now.getTime() - DONE_WAITING_WITHOUT_DUE_MS))),
      )),
    ),
    with: { site: { columns: { name: true, address: true } }, assignees: { columns: { userId: true } } },
  });
  if (!candidates.length) return [];
  const [people, previous] = await Promise.all([
    connection.select({ id: user.id, role: user.role, banned: user.banned }).from(user).where(and(eq(user.banned, false), inArray(user.role, ["admin", "manager", "executor"]))),
    connection.select({ userId: notifications.userId, type: notifications.type, orderId: notifications.orderId, createdAt: notifications.createdAt }).from(notifications).where(and(
      inArray(notifications.orderId, candidates.map(o => o.id)),
      or(inArray(notifications.type, ["overdue", "done_waiting"]), and(eq(notifications.type, "visit_today"), gte(notifications.createdAt, start), lt(notifications.createdAt, end))),
    )),
  ]);
  return planReminders(candidates, people, previous, now);
}

export async function runReminders({ dry = false, now = new Date() }: { dry?: boolean; now?: Date } = {}) {
  const reminders = dry ? await collect(db, now) : await db.transaction(async tx => {
    // Serialize internal/external cron runs across processes without a migration.
    await tx.execute(sql`select pg_advisory_xact_lock(749231, 1)`);
    const planned = await collect(tx, now);
    for (const { userId, ...notification } of planned) {
      await notifyUsers([userId], notification, { email: false, tx });
    }
    return planned;
  });
  const counts = { visit_today: 0, overdue: 0, done_waiting: 0 };
  for (const reminder of reminders) counts[reminder.type]++;
  return { dry, total: reminders.length, counts, reminders };
}
