import "server-only";
import { applyDefaultChecklist } from "@/lib/checklists";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderAssignees, orderEvents, orders, serviceSchedules, sites, type ScheduleFrequency } from "@/db/schema";
import { notifyUsers } from "@/lib/notify";
import { tbilisiToday } from "@/lib/schedule-utils";

const MONTHS: Partial<Record<ScheduleFrequency, number>> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/** Next due date. Month steps clamp to the target month's last day (31.01 → 28.02, 29.02 → 28.02). */
export function advance(dateIso: string, freq: ScheduleFrequency): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const months = MONTHS[freq];
  if (!months) {
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** 10:00 Tbilisi on the given day */
function tbilisiMorning(dateIso: string): Date {
  return new Date(`${dateIso}T10:00:00+04:00`);
}

/** Serializes generation between the daily cron, the internal scheduler and "გენერაცია ახლა". */
const SCHEDULES_LOCK_ID = 71603252;

export type GenerateResult = { created: number; skipped: number; ids: number[] };

/**
 * Creates orders for every active schedule whose next date is within its lead window.
 * Idempotent: a schedule never gets two orders for the same due date.
 */
export async function generateDueOrders(userId: string | null = null): Promise<GenerateResult> {
  const today = tbilisiToday();
  const result: GenerateResult = { created: 0, skipped: 0, ids: [] };
  const notices: { userIds: string[]; title: string; body: string; orderId: number }[] = [];

  await db.transaction(async (tx) => {
    // Another run holds the lock: it creates the same orders, so this one does nothing.
    const lock = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${SCHEDULES_LOCK_ID}) as locked`);
    if (!lock.rows[0]?.locked) return;

    const due = await tx.query.serviceSchedules.findMany({
      where: and(eq(serviceSchedules.active, true), lte(serviceSchedules.nextDate, sql`${today}::date + ${serviceSchedules.leadDays}`)),
      with: { client: true, site: true },
      orderBy: [asc(serviceSchedules.nextDate)],
    });

    for (const s of due) {
      const limit = new Date(`${today}T00:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + s.leadDays);
      // guard: loop at most 12 periods in case a schedule was left behind for long
      for (let i = 0; i < 12; i++) {
        if (new Date(`${s.nextDate}T00:00:00Z`) > limit) break;
        const [existing] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.scheduleId, s.id), eq(orders.dueDate, s.nextDate)));

        if (existing) {
          result.skipped++;
        } else {
          const [row] = await tx
            .insert(orders)
            .values({
              title: s.title,
              description: s.description,
              type: "service",
              status: s.assigneeIds.length ? "assigned" : "new",
              priority: "normal",
              systemType: s.systemType,
              clientId: s.clientId,
              siteId: s.siteId,
              address: s.site?.address ?? null,
              dueDate: s.nextDate,
              scheduledAt: tbilisiMorning(s.nextDate),
              amount: s.amount,
              source: "schedule",
              triaged: true,
              scheduleId: s.id,
              createdBy: userId,
            })
            .returning({ id: orders.id });
          await tx.insert(orderEvents).values({ orderId: row.id, userId, type: "created_from_schedule", data: { scheduleId: s.id, title: s.title } });
          if (s.assigneeIds.length) {
            await tx.insert(orderAssignees).values(s.assigneeIds.map((u) => ({ orderId: row.id, userId: u, assignedBy: userId })));
            notices.push({ userIds: s.assigneeIds, title: `დაგენიშნათ გრაფიკული შეკვეთა`, body: `${s.title} · ${s.nextDate}`, orderId: row.id });
          }
          await applyDefaultChecklist(tx, row.id, s.systemType);
          result.created++;
          result.ids.push(row.id);
        }
        // advance schedule
        s.nextDate = advance(s.nextDate, s.frequency);
        await tx.update(serviceSchedules).set({ nextDate: s.nextDate, lastGeneratedAt: new Date() }).where(eq(serviceSchedules.id, s.id));
      }
    }
  });

  // Notify only after the orders are committed.
  for (const n of notices) await notifyUsers(n.userIds, { type: "assigned", title: n.title, body: n.body, orderId: n.orderId });
  return result;
}

export async function listSchedules() {
  return db.query.serviceSchedules.findMany({
    with: { client: { columns: { id: true, name: true } }, site: { columns: { id: true, name: true } } },
    orderBy: [asc(serviceSchedules.active), asc(serviceSchedules.nextDate)],
  });
}

export type ScheduleRow = Awaited<ReturnType<typeof listSchedules>>[number];

export async function listSitesFlat() {
  return db.select({ id: sites.id, clientId: sites.clientId, name: sites.name, address: sites.address }).from(sites).orderBy(asc(sites.name));
}
