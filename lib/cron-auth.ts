import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Cron endpoints accept either secret: `INBOUND_EMAIL_SECRET` for a scheduler we
 * call ourselves, and `CRON_SECRET` because that is the only token Vercel's own
 * cron sends. Checking just the first one meant Vercel's daily run was answered
 * with 401 and nothing was generated.
 */
export function cronAuthorized(req: Request): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (!given) return false;
  return [process.env.CRON_SECRET, process.env.INBOUND_EMAIL_SECRET].some((secret) => {
    if (!secret || secret.length !== given.length) return false;
    return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  });
}
