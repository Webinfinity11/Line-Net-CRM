import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), graphJson: vi.fn(), importMail: vi.fn(), token: vi.fn(), config: vi.fn() }));
vi.mock("@/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/inbound-email", () => ({ createOrderFromEmail: mocks.importMail }));
vi.mock("@/lib/outlook-connection", () => ({ getOutlookAccessToken: mocks.token, MAIL_LOCK_ID: 1 }));
vi.mock("@/lib/outlook-oauth", async (original) => ({ ...await original<typeof import("@/lib/outlook-oauth")>(), graphJson: mocks.graphJson, outlookConfig: mocks.config }));
import { mailSync, outlookConnection } from "@/db/schema";
import { pollMailbox } from "@/lib/graph-mail";
import { OutlookError } from "@/lib/outlook-oauth";

const since = new Date("2026-09-16T10:00:00Z");
let saved: Record<string, unknown>[];
let locked: boolean;
let connection: Record<string, unknown> | undefined;
const message = (id: string, date = "2026-09-16T10:01:00Z") => ({ id, internetMessageId: `<${id}>`, receivedDateTime: date, subject: id, body: { contentType: "text", content: "hello" } });
beforeEach(() => {
  vi.clearAllMocks();
  locked = true; saved = [];
  connection = { id: "shared", mailbox: "test@outlook.com", connectedAt: since };
  const tx = {
    execute: vi.fn(async () => ({ rows: [{ locked }] })),
    select: () => ({ from: (table: unknown) => ({ where: async () => table === outlookConnection ? (connection ? [connection] : []) : [{ lastReceivedAt: since }] }) }),
    insert: (table: unknown) => ({ values: (value: Record<string, unknown>) => ({ onConflictDoUpdate: async ({ set }: { set: Record<string, unknown> }) => { expect(table).toBe(mailSync); saved.push(set); } }) }),
  };
  mocks.transaction.mockImplementation((callback) => callback(tx));
  mocks.token.mockResolvedValue("access-token");
  mocks.importMail.mockResolvedValue(1);
});

it("reads /me, follows pagination and includes the cursor boundary", async () => {
  const next = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=50";
  mocks.graphJson.mockResolvedValueOnce({ value: [message("one", since.toISOString())], "@odata.nextLink": next })
    .mockResolvedValueOnce({ value: [message("two")] });
  mocks.importMail.mockResolvedValueOnce(null).mockResolvedValueOnce(2);
  expect(await pollMailbox()).toEqual({ ok: true, fetched: 2, created: 1, skipped: 1 });
  const url = new URL(mocks.graphJson.mock.calls[0][0]);
  expect(url.pathname).toBe("/v1.0/me/mailFolders/inbox/messages");
  expect(url.searchParams.get("$filter")).toBe(`receivedDateTime ge ${since.toISOString()}`);
  expect(mocks.graphJson.mock.calls[1][0]).toBe(next);
  expect(saved[0].lastReceivedAt).toEqual(new Date("2026-09-16T10:01:00Z"));
});
it("does not advance the cursor when a later page fails", async () => {
  mocks.graphJson.mockResolvedValueOnce({ value: [message("one")], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=50" })
    .mockRejectedValueOnce(new OutlookError("unavailable"));
  expect((await pollMailbox()).ok).toBe(false);
  expect(saved[0]).not.toHaveProperty("lastReceivedAt");
  expect(saved[0].lastError).toBeTruthy();
});
it("retries a message if downloading its attachments fails", async () => {
  mocks.graphJson.mockResolvedValueOnce({ value: [{ ...message("one"), hasAttachments: true }] }).mockRejectedValueOnce(new OutlookError("unavailable"));
  expect((await pollMailbox()).ok).toBe(false);
  expect(mocks.importMail).not.toHaveBeenCalled();
  expect(saved[0]).not.toHaveProperty("lastReceivedAt");
});
it("prevents overlapping syncs", async () => {
  locked = false;
  expect((await pollMailbox()).ok).toBe(false);
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.graphJson).not.toHaveBeenCalled();
});
it("surfaces expired consent without consuming messages", async () => {
  mocks.token.mockRejectedValueOnce(new OutlookError("reconnect"));
  expect(await pollMailbox()).toMatchObject({ ok: false });
  expect(mocks.graphJson).not.toHaveBeenCalled();
  expect(saved[0]).not.toHaveProperty("lastReceivedAt");
});
