import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderAssignees, orderAttachments } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import { readStoredFile } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const attachmentId = Number(id);
  if (!Number.isInteger(attachmentId)) return new Response("Not found", { status: 404 });
  const [row] = await db.select().from(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  if (!row) return new Response("Not found", { status: 404 });
  if (!isStaff(s.user.role)) {
    const [a] = await db
      .select()
      .from(orderAssignees)
      .where(and(eq(orderAssignees.orderId, row.orderId), eq(orderAssignees.userId, s.user.id)));
    if (!a) return new Response("Forbidden", { status: 403 });
  }
  const data = await readStoredFile(row.storagePath);
  const inline = row.mimeType?.startsWith("image/") || row.mimeType === "application/pdf";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mimeType ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
