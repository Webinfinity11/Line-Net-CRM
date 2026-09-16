import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ session: vi.fn(), cookies: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/outlook-connection", () => ({ saveOutlookConnection: mocks.save }));
import { GET } from "@/app/api/mail/outlook/callback/route";
import { createOutlookAuthorization } from "@/lib/outlook-oauth";
let callbackUrl: string;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OUTLOOK_CLIENT_ID", "test-client");
  vi.stubEnv("OUTLOOK_CLIENT_SECRET", "test-secret");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("MAIL_TOKEN_ENCRYPTION_KEY", "a".repeat(64));
  mocks.session.mockResolvedValue({ user: { id: "admin-id", role: "admin" }, session: { id: "session-id" } });
  const { url, cookie } = createOutlookAuthorization("session-id");
  mocks.cookies.mockResolvedValue({ get: () => ({ value: cookie }) });
  callbackUrl = `http://untrusted-host/api/mail/outlook/callback?code=example-code&state=${new URL(url).searchParams.get("state")}`;
  mocks.save.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

it.each([null, { user: { role: "manager" } }, { user: { role: "executor" } }])("rejects non-admin callbacks", async (session) => {
  mocks.session.mockResolvedValue(session);
  const result = await GET(new Request(callbackUrl));
  expect(result.headers.get("location")).toBe("http://localhost:3000/inbox?outlook=forbidden");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects callback without its browser cookie", async () => {
  mocks.cookies.mockResolvedValue({ get: () => undefined });
  const result = await GET(new Request(callbackUrl));
  expect(result.headers.get("location")).toContain("outlook=state");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("does not store tokens when consent is denied", async () => {
  const result = await GET(new Request(callbackUrl + "&error=access_denied"));
  expect(result.headers.get("location")).toContain("outlook=denied");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("binds the save to the administrator, clears state and uses the configured return origin", async () => {
  const result = await GET(new Request(callbackUrl));
  expect(mocks.save).toHaveBeenCalledWith("example-code", expect.any(String), "admin-id");
  expect(result.headers.get("location")).toBe("http://localhost:3000/inbox?outlook=connected");
  expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it("does not expose secrets from an unexpected connection error", async () => {
  mocks.save.mockRejectedValue(new Error("private-token-example"));
  const result = await GET(new Request(callbackUrl));
  expect(result.headers.get("location")).toBe("http://localhost:3000/inbox?outlook=failed");
});
