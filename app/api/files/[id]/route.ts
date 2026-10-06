import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderAssignees, orderAttachments, orders, user } from "@/db/schema";
import { getSession, isStaff } from "@/lib/session";
import { readStoredFile } from "@/lib/storage";

const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const attachmentId = Number(id);
  if (!Number.isInteger(attachmentId)) return new Response("Not found", { status: 404 });
  const [row] = await db.select().from(orderAttachments).where(eq(orderAttachments.id, attachmentId));
  if (!row) return new Response("Not found", { status: 404 });
  const mime = row.mimeType?.toLowerCase().split(";")[0].trim() ?? "";
  if (s.user.role === "client") {
    // Clients can access only images attached to their company's orders.
    if (!mime.startsWith("image/")) return new Response("Forbidden", { status: 403 });
    const [ownedOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(user, eq(user.clientId, orders.clientId))
      .where(and(eq(orders.id, row.orderId), eq(user.id, s.user.id)));
    if (!ownedOrder) return new Response("Forbidden", { status: 403 });
  } else if (!isStaff(s.user.role)) {
    const [a] = await db
      .select()
      .from(orderAssignees)
      .where(and(eq(orderAssignees.orderId, row.orderId), eq(orderAssignees.userId, s.user.id)));
    if (!a) return new Response("Forbidden", { status: 403 });
  }
  const data = await readStoredFile(row.storagePath);
  // The uploader picks the MIME type, so only known-safe types render in the browser;
  // SVG and anything else is downloaded as opaque bytes.
  const inline = INLINE_TYPES.has(mime);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": inline ? mime : "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
