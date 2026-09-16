"use server";

import { and, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { clients, sites } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import type { ActionResult } from "./orders";

const HEADERS: Record<string, string[]> = {
  name: ["კომპანია", "კლიენტი", "name", "company", "client"],
  idCode: ["ს/კ", "საიდენტიფიკაციო", "idcode", "id_code", "id"],
  contactName: ["კონტაქტი", "საკონტაქტო", "contact", "contactname"],
  phone: ["ტელეფონი", "phone", "tel"],
  email: ["ელფოსტა", "email", "mail"],
  site: ["ობიექტი", "ფილიალი", "site", "branch"],
  address: ["მისამართი", "address"],
};

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.some((h) => norm === h.toLowerCase() || norm.startsWith(h.toLowerCase()))) {
      const v = row[k];
      return v === null || v === undefined ? "" : String(v).trim();
    }
  }
  return "";
}

export async function importClientsFromExcel(fd: FormData): Promise<ActionResult<{ clients: number; sites: number; skipped: number }>> {
  const s = await getSession();
  if (!s || !isStaff(s.user.role)) return { ok: false, error: "არ გაქვთ უფლება" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "ფაილი არ არის არჩეული" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "ფაილი 10 MB-ზე დიდია" };

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  } catch {
    return { ok: false, error: "ფაილის წაკითხვა ვერ მოხერხდა. გამოიყენეთ .xlsx" };
  }
  if (rows.length === 0) return { ok: false, error: "ფაილი ცარიელია" };

  let created = 0;
  let siteCount = 0;
  let skipped = 0;
  const cache = new Map<string, number>();

  for (const row of rows) {
    const name = pick(row, HEADERS.name);
    if (!name) {
      skipped++;
      continue;
    }
    let clientId = cache.get(name.toLowerCase());
    if (!clientId) {
      const [existing] = await db.select({ id: clients.id }).from(clients).where(ilike(clients.name, name));
      if (existing) {
        clientId = existing.id;
      } else {
        const [ins] = await db
          .insert(clients)
          .values({
            name,
            idCode: pick(row, HEADERS.idCode) || null,
            contactName: pick(row, HEADERS.contactName) || null,
            phone: pick(row, HEADERS.phone) || null,
            email: pick(row, HEADERS.email) || null,
          })
          .returning({ id: clients.id });
        clientId = ins.id;
        created++;
      }
      cache.set(name.toLowerCase(), clientId);
    }
    const siteName = pick(row, HEADERS.site);
    if (siteName) {
      const [existingSite] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.clientId, clientId), ilike(sites.name, siteName)));
      if (!existingSite) {
        await db.insert(sites).values({ clientId, name: siteName, address: pick(row, HEADERS.address) || null });
        siteCount++;
      }
    }
  }
  revalidatePath("/clients");
  revalidatePath("/orders/new");
  return { ok: true, data: { clients: created, sites: siteCount, skipped } };
}
