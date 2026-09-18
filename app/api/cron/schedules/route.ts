import { cronAuthorized } from "@/lib/cron-auth";
import { generateDueOrders } from "@/lib/schedules";

/** Cron: GET/POST /api/cron/schedules with Authorization: Bearer <CRON_SECRET | INBOUND_EMAIL_SECRET>. Run daily. */
async function handle(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const res = await generateDueOrders(null);
  return Response.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
export const dynamic = "force-dynamic";
