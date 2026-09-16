import { timingSafeEqual } from "node:crypto";
import { generateDueOrders } from "@/lib/schedules";

/** Cron: GET/POST /api/cron/schedules with Authorization: Bearer <INBOUND_EMAIL_SECRET>. Run daily. */
function authorized(req: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const res = await generateDueOrders(null);
  return Response.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
export const dynamic = "force-dynamic";
