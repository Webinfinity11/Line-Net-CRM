import { cronAuthorized } from "@/lib/cron-auth";
import { runReminders } from "@/lib/reminders";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runReminders({ dry: new URL(req.url).searchParams.get("dry") === "1" });
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export const dynamic = "force-dynamic";
