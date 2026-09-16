import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { checklistTemplates, orderAssignees, orderEvents, orders, serviceSchedules, sites, type ScheduleFrequency } from "@/db/schema";
import { applyTemplate } from "@/lib/checklists";
import { notifyUsers } from "@/lib/notify";

export function advance(dateIso: string, freq: ScheduleFrequency): string {
  const d = new Date(dateIso + "T00:00:00Z");
  switch (freq) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "semiannual":
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** 10:00 Tbilisi on the given day */
function tbilisiMorning(dateIso: string): Date {
  return new Date(`${dateIso}T10:00:00+04:00`);
}

export type GenerateResult = { created: number; skipped: number; ids: number[] };

/**
 * Creates orders for every active schedule whose next date is within its lead window.
 * Idempotent: a schedule never gets two orders for the same due date.
 */
export async function generateDueOrders(userId: string | null = null): Promise<GenerateResult> {
  const due = await db.query.serviceSchedules.findMany({
    where: and(eq(serviceSchedules.active, true), lte(serviceSchedules.nextDate, sql`current_date + ${serviceSchedules.leadDays}`)),
    with: { client: true, site: true },
    orderBy: [asc(serviceSchedules.nextDate)],
  });
  const result: GenerateResult = { created: 0, skipped: 0, ids: [] };

  for (const s of due) {
    // guard: loop at most 12 periods in case a schedule was left behind for long
    for (let i = 0; i < 12; i++) {
      const [existing] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.scheduleId, s.id), eq(orders.dueDate, s.nextDate)));
      const limit = new Date(`${todayIso()}T00:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + s.leadDays);
      if (new Date(`${s.nextDate}T00:00:00Z`) > limit) break;

      if (existing) {
        result.skipped++;
      } else {
        const id = await db.transaction(async (tx) => {
          const [tplRow] = s.checklistTemplateId
            ? [{ id: s.checklistTemplateId }]
            : await tx
                .select({ id: checklistTemplates.id })
                .from(checklistTemplates)
                .where(and(eq(checklistTemplates.systemType, s.systemType), eq(checklistTemplates.isDefault, true)));
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
          }
          if (tplRow) await applyTemplate(tx, row.id, tplRow.id);
          return row.id;
        });
        if (s.assigneeIds.length) await notifyUsers(s.assigneeIds, { type: "assigned", title: `დაგენიშნათ გრაფიკული შეკვეთა`, body: `${s.title} · ${s.nextDate}`, orderId: id });
        result.created++;
        result.ids.push(id);
      }
      // advance schedule
      s.nextDate = advance(s.nextDate, s.frequency);
      await db.update(serviceSchedules).set({ nextDate: s.nextDate, lastGeneratedAt: new Date() }).where(eq(serviceSchedules.id, s.id));
    }
  }
  return result;
}

export async function listSchedules() {
  return db.query.serviceSchedules.findMany({
    with: { client: { columns: { id: true, name: true } }, site: { columns: { id: true, name: true } }, checklistTemplate: { columns: { id: true, name: true } } },
    orderBy: [asc(serviceSchedules.active), asc(serviceSchedules.nextDate)],
  });
}

export type ScheduleRow = Awaited<ReturnType<typeof listSchedules>>[number];

export async function listSitesFlat() {
  return db.select({ id: sites.id, clientId: sites.clientId, name: sites.name, address: sites.address }).from(sites).orderBy(asc(sites.name));
}
