import { cronAuthorized } from "@/lib/cron-auth";
import { pollMailbox } from "@/lib/graph-mail";

/**
 * Cron: GET/POST /api/cron/poll-mail with Authorization: Bearer <CRON_SECRET | INBOUND_EMAIL_SECRET>.
 * Vercel runs it on the schedule in vercel.json; any other scheduler can call it too.
 */
async function handle(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await pollMailbox();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
export const dynamic = "force-dynamic";
