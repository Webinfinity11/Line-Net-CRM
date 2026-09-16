"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { frequencyEnum, serviceSchedules, systemTypeEnum } from "@/db/schema";
import { generateDueOrders } from "@/lib/schedules";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const input = z.object({
  clientId: z.coerce.number().int().positive("კლიენტი სავალდებულოა"),
  siteId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  systemType: z.enum(systemTypeEnum.enumValues),
  title: z.string().trim().min(2, "სათაური ძალიან მოკლეა").max(200),
  description: z.preprocess(emptyToNull, z.string().max(5000).nullable()),
  frequency: z.enum(frequencyEnum.enumValues),
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "თარიღი არასწორია"),
  leadDays: z.coerce.number().int().min(0).max(60).default(7),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).max(99999999).nullable()),
  checklistTemplateId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable()),
  assigneeIds: z.array(z.string()).default([]),
});

async function requireStaff() {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) throw new Error("არ გაქვთ უფლება");
  return s.user;
}

function parse(fd: FormData) {
  const obj: Record<string, unknown> = Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && k !== "assigneeIds"));
  obj.assigneeIds = fd.getAll("assigneeIds").filter((v): v is string => typeof v === "string");
  return input.safeParse(obj);
}

function revalidate() {
  revalidatePath("/maintenance");
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function createSchedule(fd: FormData): Promise<ActionResult<{ id: number }>> {
  await requireStaff();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  const [row] = await db
    .insert(serviceSchedules)
    .values({ ...v, amount: v.amount === null ? null : v.amount.toFixed(2) })
    .returning({ id: serviceSchedules.id });
  revalidate();
  return { ok: true, data: { id: row.id } };
}

export async function updateSchedule(id: number, fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "არასწორი მონაცემები" };
  const v = parsed.data;
  await db
    .update(serviceSchedules)
    .set({ ...v, amount: v.amount === null ? null : v.amount.toFixed(2) })
    .where(eq(serviceSchedules.id, id));
  revalidate();
  return { ok: true };
}

export async function toggleSchedule(id: number, active: boolean): Promise<ActionResult> {
  await requireStaff();
  await db.update(serviceSchedules).set({ active }).where(eq(serviceSchedules.id, id));
  revalidate();
  return { ok: true };
}

export async function deleteSchedule(id: number): Promise<ActionResult> {
  const me = await requireStaff();
  if (me.role !== "admin") return { ok: false, error: "მხოლოდ ადმინს შეუძლია წაშლა" };
  await db.delete(serviceSchedules).where(eq(serviceSchedules.id, id));
  revalidate();
  return { ok: true };
}

export async function generateNow(): Promise<ActionResult<{ created: number; skipped: number }>> {
  const me = await requireStaff();
  const res = await generateDueOrders(me.id);
  revalidate();
  return { ok: true, data: { created: res.created, skipped: res.skipped } };
}
