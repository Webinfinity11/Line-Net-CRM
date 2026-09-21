"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderEvents, orders, sites } from "@/db/schema";
import { notifyUsers, staffUserIds } from "@/lib/notify";
import { geocodeAddress } from "@/lib/geocode";
import { portalCompanyOf, type PortalSite } from "@/lib/portal";
import { getSession } from "@/lib/session";
import { systemSlug } from "@/lib/systems";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const input = z.object({
  title: z.string().trim().min(2, "მოკლედ დაწერეთ, რა გჭირდებათ").max(200),
  description: z.preprocess(emptyToNull, z.string().trim().max(5000).nullable()),
  systemType: z.preprocess(emptyToNull, systemSlug.nullable()),
  siteId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
  urgent: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
});

/**
 * A client places an order for its own company. It lands in the inbox untriaged,
 * exactly like an email request, until a manager saves it through the edit form.
 */
export async function createPortalOrder(fd: FormData): Promise<ActionResult<{ id: number }>> {
  const s = await getSession();
  if (!s || s.user.role !== "client") return { ok: false, error: "არ გაქვთ უფლება" };
  const company = await portalCompanyOf(s.user.id);
  if (!company) return { ok: false, error: "ანგარიში კომპანიაზე არ არის მიბმული. დაუკავშირდით ლაინნეტს." };
  const parsed = await input.safeParseAsync(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;

  let address = v.address;
  if (v.siteId) {
    const [site] = await db
      .select({ address: sites.address })
      .from(sites)
      .where(and(eq(sites.id, v.siteId), eq(sites.clientId, company.id)));
    if (!site) return { ok: false, error: "ობიექტი ვერ მოიძებნა" };
    address ??= site.address;
  }
  if (!v.siteId && !address) return { ok: false, error: "აირჩიეთ ობიექტი ან ჩაწერეთ მისამართი" };

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        title: v.title,
        description: v.description,
        type: "service",
        priority: v.urgent ? "urgent" : "normal",
        clientId: company.id,
        siteId: v.siteId,
        address,
        systemType: v.systemType,
        source: "portal",
        triaged: false,
        status: "new",
        createdBy: s.user.id,
      })
      .returning({ id: orders.id });
    await tx.insert(orderEvents).values({ orderId: row.id, userId: s.user.id, type: "created" });
    return row.id;
  });

  await notifyUsers(await staffUserIds(), { type: "portal", title: `ახალი მოთხოვნა: ${company.name}`, body: v.title, orderId: id });
  revalidatePath("/inbox");
  revalidatePath("/portal");
  revalidatePath("/");
  return { ok: true, data: { id } };
}

// Only these four fields are client-editable; ownership and coordinates never come from the form.
const siteInput = z.object({
  name: z.string().trim().min(1, "სახელი სავალდებულოა").max(200),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
  contactName: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  contactPhone: z.preprocess(emptyToNull, z.string().trim().max(60).nullable()),
});

const siteColumns = { id: sites.id, name: sites.name, address: sites.address, contactName: sites.contactName, contactPhone: sites.contactPhone };

async function siteCoords(address: string | null) {
  const g = address ? await geocodeAddress(address) : null;
  return { lat: g ? g.lat.toFixed(7) : null, lng: g ? g.lng.toFixed(7) : null };
}

async function siteSaved(company: { id: number; name: string }, site: PortalSite, edited: boolean) {
  await notifyUsers(await staffUserIds(), {
    type: "portal",
    title: `${company.name}: ${edited ? "შეიცვალა მისამართი" : "დაემატა მისამართი"}`,
    body: [site.name, site.address].filter(Boolean).join(" · "),
  });
  for (const path of ["/portal/sites", "/portal/new", "/portal", "/clients", `/clients/${company.id}`, "/orders/new", "/notifications"]) revalidatePath(path);
}

export async function createPortalSite(fd: FormData): Promise<ActionResult<PortalSite>> {
  const s = await getSession();
  if (!s || s.user.role !== "client") return { ok: false, error: "არ გაქვთ უფლება" };
  const company = await portalCompanyOf(s.user.id);
  if (!company) return { ok: false, error: "ანგარიში კომპანიაზე არ არის მიბმული" };
  const parsed = siteInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const coords = await siteCoords(parsed.data.address);
  const [row] = await db.insert(sites).values({ ...parsed.data, ...coords, clientId: company.id }).returning(siteColumns);
  await siteSaved(company, row, false);
  return { ok: true, data: row };
}

export async function updatePortalSite(id: number, fd: FormData): Promise<ActionResult<PortalSite>> {
  const s = await getSession();
  if (!s || s.user.role !== "client") return { ok: false, error: "არ გაქვთ უფლება" };
  const company = await portalCompanyOf(s.user.id);
  if (!company) return { ok: false, error: "ანგარიში კომპანიაზე არ არის მიბმული" };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: "ობიექტი ვერ მოიძებნა" };
  const parsed = siteInput.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  // Both the lookup and mutation are company-scoped, including a concurrent ownership change.
  const ownedSite = and(eq(sites.id, id), eq(sites.clientId, company.id));
  const [previous] = await db.select({ address: sites.address, lat: sites.lat, lng: sites.lng }).from(sites).where(ownedSite);
  if (!previous) return { ok: false, error: "ობიექტი ვერ მოიძებნა" };
  const coords = parsed.data.address === previous.address
    ? { lat: previous.lat, lng: previous.lng }
    : await siteCoords(parsed.data.address);
  const [row] = await db.update(sites).set({ ...parsed.data, ...coords }).where(ownedSite).returning(siteColumns);
  if (!row) return { ok: false, error: "ობიექტი ვერ მოიძებნა" };
  await siteSaved(company, row, true);
  return { ok: true, data: row };
}
