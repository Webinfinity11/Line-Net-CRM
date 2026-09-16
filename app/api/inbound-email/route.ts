import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createOrderFromEmail } from "@/lib/inbound-email";

/**
 * Generic inbound-email webhook.
 *
 * POST /api/inbound-email
 * Header: Authorization: Bearer <INBOUND_EMAIL_SECRET>   (or ?secret=...)
 * Body (JSON):
 * {
 *   "messageId": "<unique id>",          // required, used for de-duplication
 *   "from": "client@company.ge",
 *   "fromName": "Client Name",           // optional
 *   "subject": "...",
 *   "text": "...",                       // plain text body (optional if html given)
 *   "html": "...",                       // optional
 *   "receivedAt": "2026-09-16T10:00:00Z",// optional
 *   "attachments": [{ "fileName": "a.pdf", "contentType": "application/pdf", "contentBase64": "..." }]
 * }
 *
 * Works with Power Automate (Outlook trigger → HTTP action), Resend/Postmark inbound (map their fields),
 * or any script that forwards mail.
 */

const schema = z.object({
  messageId: z.string().min(1).max(500),
  from: z.string().min(1).max(300),
  fromName: z.string().max(200).nullish(),
  subject: z.string().max(1000).default(""),
  text: z.string().max(200000).nullish(),
  html: z.string().max(1000000).nullish(),
  receivedAt: z.coerce.date().nullish(),
  attachments: z
    .array(z.object({ fileName: z.string().max(255), contentType: z.string().max(120).nullish(), contentBase64: z.string() }))
    .max(20)
    .optional(),
});

function authorized(req: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (header.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "invalid payload", issues: parsed.error.issues }, { status: 400 });

  const id = await createOrderFromEmail({ ...parsed.data, receivedAt: parsed.data.receivedAt ?? null });
  if (id === null) return Response.json({ ok: true, duplicate: true });
  return Response.json({ ok: true, orderId: id });
}
