import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/inbound-email", () => ({ createOrderFromEmail: m.create }));
import { POST } from "@/app/api/inbound-email/route";
const payload = { messageId: "<qa@example.com>", from: "client@example.com", fromName: "კლიენტი", subject: "დახმარება", text: "შეკეთება" };
const request = (body: unknown = payload, secret = "qa-secret") => new Request("http://localhost/api/inbound-email", { method: "POST", headers: { authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("INBOUND_EMAIL_SECRET", "qa-secret"); m.create.mockResolvedValue(42); });
it("denies a wrong secret before importing", async () => { expect((await POST(request(payload,"wrong"))).status).toBe(401); expect(m.create).not.toHaveBeenCalled(); });
it("denies a same-character-length multibyte secret without throwing", async () => { expect((await POST(request(payload,"qá-secret"))).status).toBe(401); expect(m.create).not.toHaveBeenCalled(); });
it("denies requests when no secret is configured", async () => { vi.stubEnv("INBOUND_EMAIL_SECRET", ""); expect((await POST(request())).status).toBe(401); });
it("rejects invalid JSON and invalid payload without importing", async () => { expect((await POST(request("{"))).status).toBe(400); expect((await POST(request({from:"x"}))).status).toBe(400); expect(m.create).not.toHaveBeenCalled(); });
it("passes sender, content, date and attachments to import", async () => {
 const attachment={fileName:"report.pdf",contentType:"application/pdf",contentBase64:"YQ=="};
 const res=await POST(request({...payload,receivedAt:"2026-09-24T10:00:00Z",attachments:[attachment]}));
 expect(await res.json()).toEqual({ok:true,orderId:42}); expect(m.create).toHaveBeenCalledWith({...payload,receivedAt:new Date("2026-09-24T10:00:00Z"),attachments:[attachment]});
});
it("acknowledges an already imported message without a new order", async () => { m.create.mockResolvedValue(null); expect(await (await POST(request())).json()).toEqual({ok:true,duplicate:true}); });
