import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const url = process.env.QA_DATABASE_URL;
  if (!url) return { db: {}, qaPool: null };
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || !["/linenet_qa", "/linenet_sync_qa"].includes(parsed.pathname)) {
    throw new Error("Order sync QA requires an isolated local database");
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool), qaPool: pool };
});
import { orderSyncRevision } from "@/lib/order-sync";

describe.skipIf(!process.env.QA_DATABASE_URL)("order sync committed PostgreSQL snapshots", () => {
  let pool: Pool;
  let company: number;
  let otherCompany: number;
  const prefix = `sync-${randomUUID()}`;
  const ids = Object.fromEntries(["admin", "manager", "executor", "client"].map(role => [role, `${prefix}-${role}`]));
  const created: number[] = [];
  const revision = (role: string) => orderSyncRevision(ids[role]);
  async function order(clientId: number, triaged = false, status = "new") {
    const result = await pool.query("insert into orders(title, client_id, triaged, status) values ($1,$2,$3,$4) returning id", [prefix, clientId, triaged, status]);
    created.push(result.rows[0].id);
    return result.rows[0].id as number;
  }
  beforeAll(async () => {
    pool = (await import("@/db") as unknown as { qaPool: Pool }).qaPool;
    const companies = await pool.query("insert into clients(name) values($1),($2) returning id", [prefix, `${prefix}-other`]);
    [company, otherCompany] = companies.rows.map(row => row.id);
    for (const [role, id] of Object.entries(ids)) {
      await pool.query('insert into "user"(id,name,email,role,client_id) values($1,$1,$2,$3,$4)', [id, `${id}@qa.invalid`, role, role === "client" ? company : null]);
    }
  });
  afterAll(async () => {
    await pool.query("delete from orders where id = any($1::int[])", [created]);
    await pool.query('delete from "user" where id = any($1::text[])', [Object.values(ids)]);
    await pool.query("delete from clients where id = any($1::int[])", [[company, otherCompany]]);
    await pool.end();
  });

  it("detects a portal request for staff and its client but not an executor", async () => {
    const before = await Promise.all(Object.keys(ids).map(revision));
    await order(company);
    const after = await Promise.all(Object.keys(ids).map(revision));
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[2]).toBe(before[2]);
    expect(after[3]).not.toBe(before[3]);
  });

  it("does not expose another company's changes to a client", async () => {
    const before = await revision("client");
    await order(otherCompany, true);
    expect(await revision("client")).toBe(before);
  });

  it("detects status changes without relying on timestamps or row counts", async () => {
    const id = await order(company, true);
    const before = await revision("client");
    await pool.query("update orders set status='in_progress' where id=$1", [id]);
    expect(await revision("client")).not.toBe(before);
  });

  it("detects assignment insertion and removal even when the order row is unchanged", async () => {
    const id = await order(company, true, "closed");
    const before = await revision("executor");
    await pool.query("insert into order_assignees(order_id,user_id) values($1,$2)", [id, ids.executor]);
    const assigned = await revision("executor");
    expect(assigned).not.toBe(before);
    await pool.query("delete from order_assignees where order_id=$1", [id]);
    expect(await revision("executor")).toBe(before);
  });

  it("updates an executor's bucket when their own work is done before the team is done", async () => {
    const id = await order(company, true, "in_progress");
    await pool.query("insert into order_assignees(order_id,user_id) values($1,$2)", [id, ids.executor]);
    const before = await revision("executor");
    await pool.query("update order_assignees set done_at=now() where order_id=$1", [id]);
    expect(await revision("executor")).not.toBe(before);
  });

  it("catches deletion and restores the original empty contribution", async () => {
    const before = await revision("client");
    const id = await order(company);
    expect(await revision("client")).not.toBe(before);
    await pool.query("delete from orders where id=$1", [id]);
    expect(await revision("client")).toBe(before);
  });

  it("is stable for unchanged data and returns only an opaque revision", async () => {
    const first = await revision("manager");
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(await revision("manager")).toBe(first);
  });

  it("rechecks bans and company membership from the database", async () => {
    const before = await revision("client");
    await pool.query('update "user" set client_id=$1 where id=$2', [otherCompany, ids.client]);
    expect(await revision("client")).not.toBe(before);
    await pool.query('update "user" set banned=true where id=$1', [ids.client]);
    expect(await revision("client")).toBeNull();
    expect(await orderSyncRevision("nonexistent-user")).toBeNull();
  });
});
