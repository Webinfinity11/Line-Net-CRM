import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
import { outlookScopes, createOutlookAuthorization, decryptMailSecret, encryptMailSecret, graphJson, outlookConfig, requestOutlookToken, validateOutlookState } from "@/lib/outlook-oauth";

beforeEach(() => {
  vi.stubEnv("OUTLOOK_CLIENT_ID", "test-client");
  vi.stubEnv("OUTLOOK_CLIENT_SECRET", "test-secret");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("MAIL_TOKEN_ENCRYPTION_KEY", "a".repeat(64));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Outlook authorization", () => {
  it("uses delegated read-only scopes, session-bound state and S256 PKCE", () => {
    const { url, cookie } = createOutlookAuthorization("session-a");
    const params = new URL(url).searchParams;
    const verifier = validateOutlookState(cookie, params.get("state"), "session-a");
    expect(params.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(params.get("scope")).toContain("Mail.Read");
    expect(params.get("scope")).toContain("offline_access");
    expect(params.get("scope")).not.toMatch(/Mail.Send|Mail.ReadWrite/);
    expect(params.get("redirect_uri")).toBe("http://localhost:3000/api/mail/outlook/callback");
    expect(url).not.toContain("test-secret");
    expect(cookie).not.toContain("session-a");
  });
  it.each(["wrong-state", null])("rejects mismatched or absent state (%s)", (state) => {
    const { cookie } = createOutlookAuthorization("session-a");
    expect(() => validateOutlookState(cookie, state, "session-a")).toThrow();
  });
  it("rejects another CRM session and an expired flow", () => {
    vi.useFakeTimers();
    const { url, cookie } = createOutlookAuthorization("session-a");
    const state = new URL(url).searchParams.get("state");
    expect(() => validateOutlookState(cookie, state, "session-b")).toThrow();
    vi.advanceTimersByTime(600_001);
    expect(() => validateOutlookState(cookie, state, "session-a")).toThrow();
  });
  it("encrypts tokens with randomized authenticated ciphertext and rejects tampering", () => {
    const first = encryptMailSecret("refresh-secret");
    expect(first).not.toBe(encryptMailSecret("refresh-secret"));
    expect(decryptMailSecret(first)).toBe("refresh-secret");
    const parts = first.split(".");
    const tag = Buffer.from(parts[1], "base64url"); tag[0] ^= 1;
    parts[1] = tag.toString("base64url");
    expect(() => decryptMailSecret(parts.join("."))).toThrow();
    vi.stubEnv("MAIL_TOKEN_ENCRYPTION_KEY", "b".repeat(64));
    expect(() => decryptMailSecret(first)).toThrow();
  });
  it("fails closed without configuration or HTTPS for a remote origin", () => {
    vi.stubEnv("BETTER_AUTH_URL", "http://crm.example.com");
    expect(outlookConfig()).toBeNull();
    vi.stubEnv("BETTER_AUTH_URL", "https://crm.example.com");
    expect(outlookConfig()?.redirectUri).toBe("https://crm.example.com/api/mail/outlook/callback");
    vi.stubEnv("MAIL_TOKEN_ENCRYPTION_KEY", "short");
    expect(outlookConfig()).toBeNull();
  });
});

describe("Microsoft API failures", () => {
  it("uses refresh tokens without exposing provider error details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "invalid_grant", error_description: "PRIVATE-TOKEN" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestOutlookToken({ grant_type: "refresh_token", refresh_token: "old-token" })).rejects.toMatchObject({ code: "reconnect" });
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("refresh_token")).toBe("old-token");
    expect(body.get("client_secret")).toBe("test-secret");
  });
  it("never sends tokens to foreign pagination URLs", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(graphJson("https://attacker.example/v1.0/messages", "private-token")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([[401, "reconnect"], [403, "permission"], [404, "mailbox"], [429, "unavailable"]])("maps HTTP %s to a safe actionable error", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "PRIVATE" }, { status: Number(status) })));
    await expect(graphJson("https://graph.microsoft.com/v1.0/me/messages", "token")).rejects.toMatchObject({ code });
  });
});

describe("optional sending scope", () => {
 it("requests Mail.Send only with OUTLOOK_SEND=1", () => {
  vi.stubEnv("OUTLOOK_SEND", "0"); expect(outlookScopes()).not.toContain("Mail.Send");
  vi.stubEnv("OUTLOOK_SEND", "1"); expect(outlookScopes()).toContain("Mail.Send");
 });
});
