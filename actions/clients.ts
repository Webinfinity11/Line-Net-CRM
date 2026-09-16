"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, sites } from "@/db/schema";
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
  notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

function fdToObj(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

export async function createClient(fd: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = clientInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const [row] = await db.insert(clients).values(parsed.data).returning({ id: clients.id });
  revalidatePath("/clients");
  revalidatePath("/orders/new");
  return { ok: true, data: { id: row.id } };
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
  const [row] = await db.insert(sites).values(parsed.data).returning({ id: sites.id });
  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, data: { id: row.id } };
}

export async function updateSite(id: number, fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = siteInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const { clientId, ...rest } = parsed.data;
  await db.update(sites).set(rest).where(eq(sites.id, id));
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
