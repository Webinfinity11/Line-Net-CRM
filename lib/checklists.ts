import "server-only";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { checklistTemplates, orderChecklistItems, orders, type ChecklistTemplateItem, type SystemType } from "@/db/schema";

/** Either the global db or a transaction handle */
export type DbLike = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export async function listTemplates() {
  return db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.systemType), asc(checklistTemplates.name));
}

export async function defaultTemplateFor(tx: DbLike, system: SystemType | null | undefined) {
  if (!system) return null;
  const [tpl] = await tx
    .select()
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.systemType, system), eq(checklistTemplates.isDefault, true)));
  return tpl ?? null;
}

export function normalizeItems(items: unknown): ChecklistTemplateItem[] {
  if (!Array.isArray(items)) return [];
  const out: ChecklistTemplateItem[] = [];
  for (const it of items) {
    if (typeof it === "string") {
      if (it.trim()) out.push({ label: it.trim(), required: false });
    } else if (it && typeof it === "object" && typeof (it as { label?: unknown }).label === "string") {
      const label = ((it as { label: string }).label ?? "").trim();
      if (label) out.push({ label, required: Boolean((it as { required?: unknown }).required) });
    }
  }
  return out;
}

/**
 * Appends a template's items to an order's checklist inside the given transaction.
 * Also flips the order's requiresPhoto flag when the template demands photos.
 */
export async function applyTemplate(tx: DbLike, orderId: number, templateId: number): Promise<{ added: number }> {
  const [tpl] = await tx.select().from(checklistTemplates).where(eq(checklistTemplates.id, templateId));
  if (!tpl) throw new Error("შაბლონი ვერ მოიძებნა");
  const items = normalizeItems(tpl.items);
  const [m] = await tx.select({ pos: max(orderChecklistItems.position) }).from(orderChecklistItems).where(eq(orderChecklistItems.orderId, orderId));
  let pos = m?.pos ?? 0;
  if (items.length) {
    await tx.insert(orderChecklistItems).values(items.map((it) => ({ orderId, label: it.label, required: Boolean(it.required), position: ++pos })));
  }
  if (tpl.requiresPhoto) await tx.update(orders).set({ requiresPhoto: true }).where(eq(orders.id, orderId));
  return { added: items.length };
}
