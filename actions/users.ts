"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, user } from "@/db/schema";
import { systemSlug } from "@/lib/systems";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

const roleEnum = z.enum(["admin", "manager", "executor", "client"]);

const specs = z.array(systemSlug).default([]);
const companyId = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable()).default(null);

const createInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(120),
  email: z.string().trim().email("ელფოსტა არასწორია"),
  password: z.string().min(6, "პაროლი მინიმუმ 6 სიმბოლოს უნდა შეიცავდეს"),
  role: roleEnum,
  phone: z.string().max(60).optional().or(z.literal("")),
  specializations: specs,
  clientId: companyId,
});

const updateInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(120),
  role: roleEnum,
  phone: z.string().max(60).optional().or(z.literal("")),
  password: z.string().min(6, "პაროლი მინიმუმ 6 სიმბოლოს უნდა შეიცავდეს").optional().or(z.literal("")),
  specializations: specs,
  clientId: companyId,
});

/** A client login must name its company; every other role carries none and no specializations leak onto a client. */
async function roleLinks(v: { role: z.infer<typeof roleEnum>; clientId: number | null; specializations: string[] }): Promise<{ clientId: number | null; specializations: string[] } | string> {
  if (v.role !== "client") return { clientId: null, specializations: v.specializations };
  if (!v.clientId) return "კლიენტის ანგარიშს კომპანია უნდა მიუთითოთ";
  const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, v.clientId));
  if (!c) return "კომპანია ვერ მოიძებნა";
  return { clientId: c.id, specializations: [] };
}

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.user.role !== "admin") throw new Error("მხოლოდ ადმინს აქვს უფლება");
  return s.user;
}

function fdToObj(fd: FormData) {
  const obj: Record<string, unknown> = Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && k !== "specializations"));
  obj.specializations = fd.getAll("specializations").filter((v): v is string => typeof v === "string");
  return obj;
}

export async function createUser(fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = await createInput.safeParseAsync(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const links = await roleLinks(v);
  if (typeof links === "string") return { ok: false, error: links };
  try {
    const res = await auth.api.createUser({
      headers: await headers(),
      body: { email: v.email, password: v.password, name: v.name, role: v.role as unknown as "admin", data: { phone: v.phone || null } },
    });
    await db.update(user).set(links).where(eq(user.id, res.user.id));
    revalidatePath("/settings/users");
    return { ok: true, data: { id: res.user.id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "შეცდომა";
    return { ok: false, error: /exist/i.test(msg) ? "ეს ელფოსტა უკვე რეგისტრირებულია" : msg };
  }
}

export async function updateUser(id: string, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = await updateInput.safeParseAsync(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  if (id === me.id && v.role !== "admin") return { ok: false, error: "საკუთარ თავს ადმინის როლს ვერ მოხსნით" };
  const links = await roleLinks(v);
  if (typeof links === "string") return { ok: false, error: links };
  await db
    .update(user)
    .set({ name: v.name, role: v.role, phone: v.phone || null, ...links, updatedAt: new Date() })
    .where(eq(user.id, id));
  if (v.password) {
    await auth.api.setUserPassword({ headers: await headers(), body: { userId: id, newPassword: v.password } });
  }
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setUserBanned(id: string, banned: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false, error: "საკუთარ თავს ვერ დაბლოკავთ" };
  await db.update(user).set({ banned, banReason: banned ? "დეაქტივირებულია ადმინის მიერ" : null, updatedAt: new Date() }).where(eq(user.id, id));
  if (banned) await auth.api.revokeUserSessions({ headers: await headers(), body: { userId: id } });
  revalidatePath("/settings/users");
  return { ok: true };
}
