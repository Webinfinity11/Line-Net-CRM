import "server-only";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { executorCompetencies, orderAssignees, orders, user } from "@/db/schema";
import { canHandle, competenceLabel, type Competencies } from "./competency-utils";
import { systemLabels } from "./systems";

export { canHandle, competenceLabel, type Competencies } from "./competency-utils";

export async function competenciesByUser(userIds: string[]): Promise<Map<string, Competencies>> {
  const result = new Map<string, Competencies>(userIds.map(id => [id, "all"]));
  if (!userIds.length) return result;
  const rows = await db.select().from(executorCompetencies)
    .where(inArray(executorCompetencies.userId, userIds)).orderBy(asc(executorCompetencies.systemSlug));
  for (const row of rows) {
    const comp = result.get(row.userId);
    result.set(row.userId, comp === "all" || !comp ? [row.systemSlug] : [...comp, row.systemSlug]);
  }
  return result;
}

/** All supplied categories must be covered; an empty selection imposes no category constraint. */
export async function candidateExecutors(systemTypes: string[]) {
  const rows = await db.select({ id: user.id, name: user.name, role: user.role, image: user.image })
    .from(user).where(and(eq(user.role, "executor"), eq(user.banned, false))).orderBy(asc(user.name));
  const [competencies, labels] = await Promise.all([competenciesByUser(rows.map(u => u.id)), systemLabels()]);
  return rows.map(u => {
    const comp = competencies.get(u.id) ?? "all";
    return { ...u, competencies: comp, competenceLabel: competenceLabel(comp, labels) };
  }).filter(u => systemTypes.every(system => canHandle(system, u.competencies)));
}

/** The board and its mobile badge use exactly the same visibility predicate. */
export async function boardVisibility(me: { id: string; role: string }) {
  const comp = me.role === "executor" ? (await competenciesByUser([me.id])).get(me.id) ?? "all" : "all";
  return and(eq(orders.triaged, true), inArray(orders.status, ["new", "assigned", "in_progress", "done"]),
    comp === "all" ? undefined : or(
      isNull(orders.systemType),
      inArray(orders.systemType, comp),
      inArray(orders.id, db.select({ orderId: orderAssignees.orderId }).from(orderAssignees).where(eq(orderAssignees.userId, me.id))),
    ));
}
