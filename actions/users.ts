"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import type { ActionResult } from "./orders";

const roleEnum = z.enum(["admin", "manager", "executor"]);

const createInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(120),
  email: z.string().trim().email("ელფოსტა არასწორია"),
  password: z.string().min(6, "პაროლი მინიმუმ 6 სიმბოლო"),
  role: roleEnum,
  phone: z.string().max(60).optional().or(z.literal("")),
});

const updateInput = z.object({
  name: z.string().trim().min(2, "სახელი ძალიან მოკლეა").max(120),
  role: roleEnum,
  phone: z.string().max(60).optional().or(z.literal("")),
  password: z.string().min(6, "პაროლი მინიმუმ 6 სიმბოლო").optional().or(z.literal("")),
});

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.user.role !== "admin") throw new Error("მხოლოდ ადმინს აქვს უფლება");
  return s.user;
}

function fdToObj(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

export async function createUser(fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = createInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  try {
    const res = await auth.api.createUser({
      headers: await headers(),
      body: { email: v.email, password: v.password, name: v.name, role: v.role as unknown as "admin", data: { phone: v.phone || null } },
    });
    revalidatePath("/settings/users");
    return { ok: true, data: { id: res.user.id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "შეცდომა";
    return { ok: false, error: /exist/i.test(msg) ? "ეს ელფოსტა უკვე რეგისტრირებულია" : msg };
  }
}

export async function updateUser(id: string, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = updateInput.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  if (id === me.id && v.role !== "admin") return { ok: false, error: "საკუთარ თავს ადმინის როლს ვერ მოხსნით" };
  await db.update(user).set({ name: v.name, role: v.role, phone: v.phone || null, updatedAt: new Date() }).where(eq(user.id, id));
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
