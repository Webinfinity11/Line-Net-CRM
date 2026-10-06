import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/order-sync", () => ({ orderSyncRevision: vi.fn() }));
import { getSession } from "@/lib/session";
import { orderSyncRevision } from "@/lib/order-sync";
import { GET } from "@/app/api/sync/route";

const session = vi.mocked(getSession);
const revision = vi.mocked(orderSyncRevision);
const decoder = new TextDecoder();
const streams: ReadableStreamDefaultReader<Uint8Array>[] = [];
async function stream(signal?: AbortSignal) {
  const response = await GET(new Request("http://localhost/api/sync", { signal }));
  const reader = response.body!.getReader();
  streams.push(reader);
  return { response, reader, read: async () => decoder.decode((await reader.read()).value) };
}

describe("authenticated order synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    session.mockResolvedValue({ user: { id: "reader" } } as Awaited<ReturnType<typeof getSession>>);
    revision.mockResolvedValue("version-1");
  });
  afterEach(async () => {
    for (const reader of streams.splice(0)) await reader.cancel();
    vi.useRealTimers();
  });

  it("rejects anonymous access before querying any orders", async () => {
    session.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/sync"));
    expect(response.status).toBe(401);
    expect(revision).not.toHaveBeenCalled();
  });

  it("rejects deleted or banned users", async () => {
    revision.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/sync"))).status).toBe(403);
  });

  it("offers an uncached fallback without trusting a user ID in the URL", async () => {
    const response = await GET(new Request("http://localhost/api/sync?transport=poll&userId=admin"));
    expect(await response.json()).toEqual({ revision: "version-1" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(revision).toHaveBeenCalledWith("reader");
  });

  it("sends the initial snapshot, heartbeats on idle, and changes only after commit is visible", async () => {
    const { response, read } = await stream();
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await read()).toContain("retry: 1000");
    expect(await read()).toContain('"revision":"version-1"');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await read()).toBe(": keepalive\n\n");
    revision.mockResolvedValue("version-2");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await read()).toContain('"revision":"version-2"');
  });

  it("closes on permission revocation without publishing another snapshot", async () => {
    const { read, reader } = await stream();
    await read(); await read();
    revision.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await reader.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up timers when a browser disconnects", async () => {
    const { reader } = await stream();
    await reader.cancel();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(revision).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes after a database failure so a reconnect can recover missed changes", async () => {
    const { read, reader } = await stream();
    await read(); await read();
    revision.mockRejectedValue(new Error("temporary outage"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await reader.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts an in-flight snapshot safely", async () => {
    const controller = new AbortController();
    const { read, reader } = await stream(controller.signal);
    await read(); await read();
    let resolve!: (value: string) => void;
    revision.mockImplementation(() => new Promise<string>(r => { resolve = r; }));
    await vi.advanceTimersByTimeAsync(2_000);
    controller.abort();
    resolve("version-2");
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await reader.read()).done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
