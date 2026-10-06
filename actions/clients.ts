"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, sites } from "@/db/schema";
import { geocodeAddress } from "@/lib/geocode";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const clientInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(200),
  idCode: z.preprocess(emptyToNull, z.string().max(30).nullable()),
  contactName: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  phone: z.preprocess(emptyToNull, z.string().max(60).nullable()),
  email: z.preprocess(emptyToNull, z.string().email("ელფოსტა არასწორია").nullable()),
  notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

const siteInput = z.object({
  clientId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "სახელი სავალდებულოა").max(200),
  address: z.preprocess(emptyToNull, z.string().max(300).nullable()),
  contactName: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  contactPhone: z.preprocess(emptyToNull, z.string().max(60).nullable()),
  lat: z.preprocess(emptyToNull, z.coerce.number().min(-90).max(90).nullable()),
  lng: z.preprocess(emptyToNull, z.coerce.number().min(-180).max(180).nullable()),
  notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

async function resolveCoords(v: { address: string | null; lat: number | null; lng: number | null }, previousAddress?: string | null) {
  if (v.lat !== null && v.lng !== null) return { lat: v.lat.toFixed(7), lng: v.lng.toFixed(7) };
  if (v.address && v.address !== previousAddress) {
    const g = await geocodeAddress(v.address);
    if (g) return { lat: g.lat.toFixed(7), lng: g.lng.toFixed(7) };
  }
  return { lat: null, lng: null };
}

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

function fdToObj(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

/** Sites typed in the same dialog arrive as siteName[], siteAddress[], siteContact[], sitePhone[]. */
function sitesFromForm(fd: FormData) {
  const names = fd.getAll("siteName").map((v) => String(v).trim());
  const addresses = fd.getAll("siteAddress").map((v) => String(v).trim());
  const contacts = fd.getAll("siteContact").map((v) => String(v).trim());
  const phones = fd.getAll("sitePhone").map((v) => String(v).trim());
  return names
    .map((name, i) => ({ name, address: addresses[i] ?? "", contactName: contacts[i] ?? "", contactPhone: phones[i] ?? "" }))
    .filter((r) => r.name.length > 0 || r.address.length > 0)
    .map((r) => ({ ...r, name: r.name || r.address.slice(0, 80) }));
}

export async function createClient(fd: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = clientInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const rows = sitesFromForm(fd);
  const [row] = await db.insert(clients).values(parsed.data).returning({ id: clients.id });
  for (const site of rows) {
    const coords = await resolveCoords({ address: site.address || null, lat: null, lng: null });
    await db.insert(sites).values({
      clientId: row.id,
      name: site.name,
      address: site.address || null,
      contactName: site.contactName || null,
      contactPhone: site.contactPhone || null,
      ...coords,
    });
  }
  revalidatePath("/clients");
  revalidatePath(`/clients/${row.id}`);
  revalidatePath("/orders/new");
  return { ok: true, data: { id: row.id } };
}

/** Paste a branch list: one object per line, "name, address" or just an address. */
export async function addSitesBulk(clientId: number, fd: FormData): Promise<ActionResult<{ added: number }>> {
  await requireStaff();
  const raw = String(fd.get("lines") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (lines.length === 0) return { ok: false, error: "სია ცარიელია" };
  let added = 0;
  for (const line of lines) {
    const [first, ...rest] = line.split(/[,;]/);
    const name = first.trim().slice(0, 200);
    const address = rest.join(",").trim().slice(0, 300) || null;
    if (!name) continue;
    const coords = await resolveCoords({ address, lat: null, lng: null });
    await db.insert(sites).values({ clientId, name, address, ...coords });
    added++;
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/orders/new");
  return { ok: true, data: { added } };
}

export async function updateClient(id: number, fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = clientInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  await db.update(clients).set(parsed.data).where(eq(clients.id, id));
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function deleteClient(id: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (me.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია წაშლა" };
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
  return { ok: true };
}

export async function createSite(fd: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = siteInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const coords = await resolveCoords(parsed.data);
  const [row] = await db.insert(sites).values({ ...parsed.data, ...coords }).returning({ id: sites.id });
  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: { id: row.id } };
}

export async function updateSite(id: number, fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = siteInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const { clientId, ...rest } = parsed.data;
  const [prev] = await db.select({ address: sites.address, lat: sites.lat, lng: sites.lng }).from(sites).where(eq(sites.id, id));
  // the form always sends lat/lng, so empty ones mean the pin was cleared
  const coords = await resolveCoords(rest, prev?.address);
  await db.update(sites).set({ ...rest, ...coords }).where(eq(sites.id, id));
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteSite(id: number): Promise<ActionResult> {
  await requireStaff();
  const [row] = await db.select({ clientId: sites.clientId }).from(sites).where(eq(sites.id, id));
  await db.delete(sites).where(eq(sites.id, id));
  if (row) revalidatePath(`/clients/${row.clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}
