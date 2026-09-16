import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { saveOutlookConnection } from "@/lib/outlook-connection";
import { OUTLOOK_COOKIE, OutlookError, outlookConfig, validateOutlookState } from "@/lib/outlook-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cfg = outlookConfig();
  // Never derive OAuth's redirect origin from forwarded/request host headers.
  if (!cfg) return new Response("Outlook connection is not configured", { status: 503 });
  const cookieStore = await cookies();
  const result = (status: string) => {
    const response = NextResponse.redirect(new URL(`/inbox?outlook=${status}`, cfg.origin));
    response.cookies.set(OUTLOOK_COOKIE, "", { maxAge: 0, path: "/api/mail/outlook", httpOnly: true, sameSite: "lax", secure: cfg.origin.startsWith("https:") });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  try {
    const s = await getSession();
    if (s?.user.role !== "admin") return result("forbidden");
    const params = new URL(request.url).searchParams;
    const verifier = validateOutlookState(cookieStore.get(OUTLOOK_COOKIE)?.value, params.get("state"), s.session.id);
    if (params.has("error")) return result("denied");
    const code = params.get("code");
    if (!code) return result("failed");
    await saveOutlookConnection(code, verifier, s.user.id);
    return result("connected");
  } catch (error) {
    // Do not expose provider responses, authorization codes or tokens in URLs/logs.
    return result(error instanceof OutlookError ? error.code : "failed");
  }
}
