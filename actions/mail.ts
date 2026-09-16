"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pollMailbox } from "@/lib/graph-mail";
import { getSession, isStaff } from "@/lib/session";
import { createOutlookAuthorization, OUTLOOK_COOKIE, outlookConfig } from "@/lib/outlook-oauth";
import { removeOutlookConnection } from "@/lib/outlook-connection";
import type { ActionResult } from "./orders";

export async function pollMailNow(): Promise<ActionResult<{ created: number; fetched: number }>> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const res = await pollMailbox();
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/inbox");
  revalidatePath("/");
  return { ok: true, data: { created: res.created, fetched: res.fetched } };
}

export async function connectOutlook() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role !== "admin") redirect("/inbox?outlook=forbidden");
  if (!outlookConfig()) redirect("/inbox?outlook=setup");
  const authorization = createOutlookAuthorization(s.session.id);
  (await cookies()).set(OUTLOOK_COOKIE, authorization.cookie, {
    httpOnly: true, secure: authorization.secure, sameSite: "lax", path: "/api/mail/outlook", maxAge: 600,
  });
  redirect(authorization.url);
}

export async function disconnectOutlook(): Promise<ActionResult> {
  const s = await getSession();
  if (s?.user.role !== "admin") return { ok: false, error: "ფოსტის გათიშვა მხოლოდ ადმინისტრატორს შეუძლია" };
  await removeOutlookConnection();
  revalidatePath("/inbox");
  return { ok: true };
}
