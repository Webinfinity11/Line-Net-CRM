import { canAccessOrderComments, listCommentsSince } from "@/lib/comments";
import { getSession } from "@/lib/session";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const orderId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(orderId) || orderId <= 0 || orderId > 2147483647) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const raw = new URL(req.url).searchParams.get("since") ?? "0";
  const since = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(since) || since < 0 || since > 2147483647) {
    return Response.json({ error: "invalid cursor" }, { status: 400 });
  }
  if (!(await canAccessOrderComments(orderId, session.user))) return Response.json({ error: "not found" }, { status: 404 });
  const rows = await listCommentsSince(orderId, since);
  const items = rows.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), user: c.user }));
  return Response.json({ items, nextSince: items.at(-1)?.id ?? since }, { headers: { "Cache-Control": "private, no-store" } });
}

export const dynamic = "force-dynamic";
