"use server";

import { revalidatePath } from "next/cache";
import { pollMailbox } from "@/lib/graph-mail";
import { getSession, isStaff } from "@/lib/session";
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
