import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const OUTLOOK_COOKIE = "outlook-connect";
export const OUTLOOK_CALLBACK = "/api/mail/outlook/callback";
export const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const SCOPES = "offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read";

export const outlookMessages = {
  setup: "Outlook-ის დასაკავშირებლად ადმინისტრატორმა აპლიკაციის პარამეტრები უნდა გამართოს.",
  forbidden: "ფოსტის დაკავშირება მხოლოდ ადმინისტრატორს შეუძლია.",
  state: "დაკავშირების სესია დასრულდა ან არ ემთხვევა მიმდინარე სესიას. სცადეთ თავიდან.",
  denied: "Microsoft-ის ნებართვა არ გაცემულა. ფოსტა არ დაკავშირებულა.",
  reconnect: "Microsoft-ის წვდომა დასრულდა. ხელახლა დააკავშირეთ იგივე ფოსტა.",
  credentials: "Microsoft-ის აპლიკაციის პარამეტრები შესამოწმებელია.",
  mailbox: "ამ ანგარიშის Outlook ფოსტა მიუწვდომელია. გამოიყენეთ მოქმედი Outlook.com ან Hotmail ფოსტა.",
  permission: "წერილების წაკითხვის ნებართვა არ არის გაცემული. ხელახლა დააკავშირეთ ფოსტა.",
  unavailable: "Microsoft-თან დაკავშირება ვერ მოხერხდა. სცადეთ მოგვიანებით.",
  different: "სხვა ფოსტა უკვე დაკავშირებულია. ახალი ანგარიშის დასამატებლად ჯერ არსებული გათიშეთ.",
  failed: "ფოსტის დაკავშირება ვერ დასრულდა. სცადეთ თავიდან.",
} as const;

export type OutlookErrorCode = keyof typeof outlookMessages;
export class OutlookError extends Error {
  constructor(public code: OutlookErrorCode) { super(outlookMessages[code]); }
}

function encryptionKey() {
  const key = process.env.MAIL_TOKEN_ENCRYPTION_KEY;
  if (!key || !/^[a-f\d]{64}$/i.test(key)) throw new OutlookError("setup");
  return Buffer.from(key, "hex");
}

export function outlookConfig() {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const base = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !base) return null;
  try {
    encryptionKey();
    const url = new URL(base);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return { clientId, clientSecret, origin: url.origin, redirectUri: new URL(OUTLOOK_CALLBACK, url.origin).href };
  } catch { return null; }
}

export function encryptMailSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptMailSecret(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new OutlookError("reconnect");
  const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function createOutlookAuthorization(sessionId: string) {
  const cfg = outlookConfig();
  if (!cfg) throw new OutlookError("setup");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const cookie = encryptMailSecret(JSON.stringify({ state, verifier, sessionId, expires: Date.now() + 10 * 60_000 }));
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  url.search = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", response_mode: "query",
    scope: SCOPES, prompt: "select_account", state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  }).toString();
  return { url: url.href, cookie, secure: cfg.origin.startsWith("https:") };
}

export function validateOutlookState(cookie: string | undefined, state: string | null, sessionId: string) {
  try {
    if (!cookie || !state) throw new Error();
    const data = JSON.parse(decryptMailSecret(cookie));
    if (typeof data.state !== "string" || typeof data.verifier !== "string" ||
        data.sessionId !== sessionId || typeof data.expires !== "number" || data.expires <= Date.now()) throw new Error();
    const expected = Buffer.from(data.state);
    const actual = Buffer.from(state);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
    return data.verifier as string;
  } catch { throw new OutlookError("state"); }
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

export async function requestOutlookToken(params: Record<string, string>): Promise<TokenResponse> {
  const cfg = outlookConfig();
  if (!cfg) throw new OutlookError("setup");
  let response: Response;
  try {
    response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: SCOPES, ...params }),
    });
  } catch { throw new OutlookError("unavailable"); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (["invalid_grant", "interaction_required"].includes(result.error)) throw new OutlookError("reconnect");
    if (["invalid_client", "unauthorized_client"].includes(result.error)) throw new OutlookError("credentials");
    throw new OutlookError("unavailable");
  }
  if (typeof result.access_token !== "string" || typeof result.expires_in !== "number" || result.expires_in <= 0) throw new OutlookError("failed");
  return result;
}

/** Only send tokens to Graph; a malformed pagination URL must never leak them. */
export async function graphJson<T>(url: string, token: string): Promise<T> {
  const target = new URL(url);
  if (target.origin !== "https://graph.microsoft.com" || !target.pathname.startsWith("/v1.0/")) throw new OutlookError("failed");
  let response: Response;
  try {
    response = await fetch(target, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new OutlookError("unavailable"); }
  if (!response.ok) {
    if (response.status === 401) throw new OutlookError("reconnect");
    if (response.status === 403) throw new OutlookError("permission");
    if ([400, 404].includes(response.status)) throw new OutlookError("mailbox");
    throw new OutlookError("unavailable");
  }
  return response.json();
}
