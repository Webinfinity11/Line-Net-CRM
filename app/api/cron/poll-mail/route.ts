import { timingSafeEqual } from "node:crypto";
import { pollMailbox } from "@/lib/graph-mail";

/**
 * Cron endpoint: GET or POST /api/cron/poll-mail with Authorization: Bearer <INBOUND_EMAIL_SECRET>.
 * Schedule it every 5 minutes (Railway cron, GitHub Actions, or any scheduler).
 */
function authorized(req: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await pollMailbox();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
export const dynamic = "force-dynamic";
