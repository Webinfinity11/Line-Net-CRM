"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { orderEvents, orderItems, orders, quoteItems, quotes, services } from "@/db/schema";
import { recomputeOrderAmount } from "@/lib/order-items";
import { recomputeQuoteTotal } from "@/lib/quote-total";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const quoteInput = z.object({
  title: z.string().trim().min(2, "სათაური ძალიან მოკლეა").max(200),
  clientId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  siteId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  systemType: z.preprocess(emptyToNull, z.string().max(40).nullable()),
  note: z.preprocess(emptyToNull, z.string().max(4000).nullable()),
  terms: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
  validUntil: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  vatPercent: z.coerce.number().min(0).max(100).default(0),
});

async function requireStaff() {
  const s = await getSession();
  return s && isStaff(s.user.role) ? s.user : null;
}

function revalidateQuotes(id?: number) {
  revalidatePath("/quotes");
  if (id) revalidatePath(`/quotes/${id}`);
  revalidatePath("/");
}

export async function createQuote(fd: FormData): Promise<ActionResult<{ id: number }>> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = quoteInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const [row] = await db
    .insert(quotes)
    .values({ ...v, vatPercent: String(v.vatPercent), createdBy: me.id })
    .returning({ id: quotes.id });
  revalidateQuotes(row.id);
  return { ok: true, data: { id: row.id } };
}

export async function createQuoteAndOpen(fd: FormData) {
  const res = await createQuote(fd);
  if (res.ok && res.data) redirect(`/quotes/${res.data.id}`);
  return res;
}

export async function updateQuote(id: number, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = quoteInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  await db
    .update(quotes)
    .set({ ...v, vatPercent: String(v.vatPercent), updatedAt: new Date() })
    .where(eq(quotes.id, id));
  revalidateQuotes(id);
  return { ok: true };
}

export async function setQuoteStatus(id: number, status: "draft" | "sent" | "accepted" | "declined"): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  await db
    .update(quotes)
    .set({
      status,
      sentAt: status === "sent" ? new Date() : undefined,
      decidedAt: status === "accepted" || status === "declined" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));
  revalidateQuotes(id);
  return { ok: true };
}

export async function deleteQuote(id: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me || me.role !== "admin") return { ok: false, error: "წაშლა მხოლოდ ადმინს შეუძლია" };
  await db.delete(quotes).where(eq(quotes.id, id));
  revalidatePath("/quotes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

const itemInput = z.object({
  serviceId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  name: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  unit: z.string().trim().max(30).default("ცალი"),
  quantity: z.coerce.number().min(0.01).max(999999),
  unitPrice: z.coerce.number().min(0).max(99999999),
});

export async function addQuoteItem(quoteId: number, fd: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const parsed = itemInput.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  let name = v.name;
  let unit = v.unit;
  if (v.serviceId) {
    const [svc] = await db.select().from(services).where(eq(services.id, v.serviceId));
    if (!svc) return { ok: false, error: "სერვისი ვერ მოიძებნა" };
    name = name ?? svc.name;
    unit = unit || svc.unit;
  }
  if (!name) return { ok: false, error: "აირჩიეთ სერვისი ან ჩაწერეთ დასახელება" };
  await db.transaction(async (tx) => {
    await tx.insert(quoteItems).values({ quoteId, serviceId: v.serviceId, name, unit, quantity: String(v.quantity), unitPrice: String(v.unitPrice) });
    await recomputeQuoteTotal(tx, quoteId);
  });
  revalidateQuotes(quoteId);
  return { ok: true };
}

export async function updateQuoteItem(itemId: number, quantity: number, unitPrice: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "რაოდენობა არასწორია" };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: "ფასი არასწორია" };
  const [item] = await db.select({ quoteId: quoteItems.quoteId }).from(quoteItems).where(eq(quoteItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  await db.transaction(async (tx) => {
    await tx.update(quoteItems).set({ quantity: String(quantity), unitPrice: String(unitPrice) }).where(eq(quoteItems.id, itemId));
    await recomputeQuoteTotal(tx, item.quoteId);
  });
  revalidateQuotes(item.quoteId);
  return { ok: true };
}

export async function removeQuoteItem(itemId: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const [item] = await db.select({ quoteId: quoteItems.quoteId }).from(quoteItems).where(eq(quoteItems.id, itemId));
  if (!item) return { ok: false, error: "პოზიცია ვერ მოიძებნა" };
  await db.transaction(async (tx) => {
    await tx.delete(quoteItems).where(eq(quoteItems.id, itemId));
    await recomputeQuoteTotal(tx, item.quoteId);
  });
  revalidateQuotes(item.quoteId);
  return { ok: true };
}

/**
 * Accepted offer becomes the job: the order carries the same lines, so the total,
 * the payment status and the handover document all follow from what the client approved.
 */
export async function convertQuoteToOrder(id: number): Promise<ActionResult<{ orderId: number }>> {
  const me = await requireStaff();
  if (!me) return { ok: false, error: "არ გაქვთ უფლება" };
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, id), with: { items: true } });
  if (!quote) return { ok: false, error: "შეთავაზება ვერ მოიძებნა" };
  if (quote.orderId) return { ok: false, error: "შეკვეთა უკვე შექმნილია" };
  if (quote.items.length === 0) return { ok: false, error: "ჯერ დაამატეთ პოზიციები" };

  const orderId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        title: quote.title,
        description: quote.note,
        type: "project",
        status: "new",
        priority: "normal",
        systemType: quote.systemType,
        clientId: quote.clientId,
        siteId: quote.siteId,
        amount: quote.total,
        source: "manual",
        triaged: true,
        createdBy: me.id,
      })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      quote.items.map((i) => ({ orderId: row.id, serviceId: i.serviceId, name: i.name, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, createdBy: me.id })),
    );
    await tx.insert(orderEvents).values({ orderId: row.id, userId: me.id, type: "created", data: { fromQuote: quote.number } });
    await recomputeOrderAmount(tx, row.id);
    await tx.update(quotes).set({ orderId: row.id, status: "accepted", decidedAt: new Date(), updatedAt: new Date() }).where(eq(quotes.id, id));
    return row.id;
  });

  revalidateQuotes(id);
  revalidatePath("/orders");
  return { ok: true, data: { orderId } };
}
