import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ enabled: vi.fn(), insert: vi.fn(), values: vi.fn(), transaction: vi.fn(), smtp: vi.fn(), configured: vi.fn(), previewOrder: vi.fn(), token: vi.fn(), graph: vi.fn(), company: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: { insert: m.insert, transaction: m.transaction, query: { orders: { findFirst: m.previewOrder } } } }));
vi.mock("@/lib/settings", () => ({ clientEmailsEnabled: m.enabled, getCompanySettings: m.company }));
vi.mock("@/lib/notify", () => ({ smtpConfigured: m.configured, sendSmtpMessage: m.smtp }));
vi.mock("@/lib/outlook-connection", () => ({ getOutlookAccessToken: m.token, MAIL_LOCK_ID: 1 }));
vi.mock("@/lib/outlook-oauth", () => ({ GRAPH_URL: "https://graph.microsoft.com/v1.0", graphJson: m.graph }));
import { sendClientMail } from "@/lib/client-mail";
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); m.insert.mockReturnValue({ values: m.values }); m.company.mockResolvedValue({}); });
describe("client mail send gate", () => {
 it("disabled means no transport, no token refresh and a skipped event", async () => {
  m.enabled.mockResolvedValue(false);
  await sendClientMail(9, "received", "manager");
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ orderId: 9, userId: "manager", type: "client_email", data: expect.objectContaining({ ok: false, skipped: expect.any(String) }) }));
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.smtp).not.toHaveBeenCalled(); expect(m.token).not.toHaveBeenCalled(); expect(m.previewOrder).not.toHaveBeenCalled();
 });
 it("local dry run stops before any outbound work even if the shared setting is enabled", async () => {
  vi.stubEnv("CLIENT_MAIL_DRY_RUN", "1"); m.enabled.mockResolvedValue(true);
  await sendClientMail(9, "completed", "manager");
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.smtp).not.toHaveBeenCalled();
 });
 it("logs a missing recipient without calling a transport", async () => {
  m.enabled.mockResolvedValue(true); m.previewOrder.mockResolvedValue({ source: "manual", emailFrom: null, number: "LN-9", title: "სამუშაო", scheduledAt: null, completionNote: null, amount: null, vatPercent: "0", items: [], client: null, site: null });
  await sendClientMail(9, "received", "manager");
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.smtp).not.toHaveBeenCalled();
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ skipped: "მიმღები არ არის" }) }));
 });
 it("uses SMTP threading when Graph has no send grant", async () => {
  m.enabled.mockResolvedValue(true); m.configured.mockReturnValue(true); m.transaction.mockResolvedValue(null);
  m.previewOrder.mockResolvedValue({ source: "email", emailFrom: "sender@example.com", emailMessageId: "<original@example.com>", number: "LN-9", title: "სამუშაო", scheduledAt: null, completionNote: null, amount: null, vatPercent: "0", items: [], client: null, site: null });
  await sendClientMail(9, "received", "manager");
  expect(m.smtp).toHaveBeenCalledWith(expect.objectContaining({ to: ["sender@example.com"], inReplyTo: "<original@example.com>", references: "<original@example.com>" }));
 });
 it("uses Graph reply in the existing thread without SMTP", async () => {
  m.enabled.mockResolvedValue(true); m.transaction.mockResolvedValue("test-token"); m.graph.mockResolvedValue({value:[{id:"original-id"}]});
  m.previewOrder.mockResolvedValue({source:"email",emailFrom:"sender@example.com",emailMessageId:"<original@example.com>",number:"LN-9",title:"სამუშაო",scheduledAt:null,completionNote:null,amount:null,vatPercent:"0",items:[],client:null,site:null});
  const outbound=vi.fn().mockResolvedValue({ok:true}); vi.stubGlobal("fetch",outbound);
  await sendClientMail(9,"received","manager");
  expect(outbound.mock.calls[0][0]).toBe("https://graph.microsoft.com/v1.0/me/messages/original-id/reply");
  expect(JSON.parse(outbound.mock.calls[0][1].body).message.toRecipients).toEqual([{emailAddress:{address:"sender@example.com"}}]); expect(m.smtp).not.toHaveBeenCalled();
 });
 it("uses Graph sendMail for a non-email order", async () => {
  m.enabled.mockResolvedValue(true); m.transaction.mockResolvedValue("test-token");
  m.previewOrder.mockResolvedValue({source:"manual",emailFrom:null,number:"LN-9",title:"სამუშაო",scheduledAt:null,completionNote:null,amount:null,vatPercent:"0",items:[],client:{email:"office@example.com"},site:null});
  const outbound=vi.fn().mockResolvedValue({ok:true}); vi.stubGlobal("fetch",outbound);
  await sendClientMail(9,"received","manager"); expect(outbound.mock.calls[0][0]).toBe("https://graph.microsoft.com/v1.0/me/sendMail"); expect(m.smtp).not.toHaveBeenCalled();
 });
 it("logs a Graph failure without retrying through SMTP and risking duplicate delivery", async () => {
  m.enabled.mockResolvedValue(true); m.transaction.mockResolvedValue("test-token");
  m.previewOrder.mockResolvedValue({source:"manual",emailFrom:null,number:"LN-9",title:"სამუშაო",scheduledAt:null,completionNote:null,amount:null,vatPercent:"0",items:[],client:{email:"office@example.com"},site:null});
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:403}));
  await sendClientMail(9,"received","manager"); expect(m.values).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({ok:false,error:"Graph HTTP 403"})})); expect(m.smtp).not.toHaveBeenCalled();
 });

});

describe("all client mail delivery branches", () => {
 const order = {source:"email",emailFrom:"კლიენტი <sender@example.com>",emailMessageId:"<original@example.com>",number:"LN-9",title:"სამუშაო",scheduledAt:new Date("2026-10-01T06:00:00Z"),completionNote:"შესრულდა",amount:"118",vatPercent:"18",items:[{name:"სერვისი",quantity:"1",unit:"ცალი",unitPrice:"100"}],client:null,site:null};
 beforeEach(() => { m.enabled.mockResolvedValue(true); m.previewOrder.mockResolvedValue(order); m.configured.mockReturnValue(true); vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("Unexpected network"))); });
 it.each(["received","scheduled","completed"] as const)("sends %s through SMTP to the imported sender and logs success", async kind => {
  m.transaction.mockResolvedValue(null); await sendClientMail(9,kind,"manager");
  expect(m.smtp).toHaveBeenCalledWith(expect.objectContaining({to:["sender@example.com"],subject:expect.stringContaining("LN-9"),inReplyTo:order.emailMessageId,html:expect.stringContaining("LN-9")}));
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({userId:"manager",data:expect.objectContaining({kind,ok:true,transport:"smtp",to:["sender@example.com"]})})); expect(fetch).not.toHaveBeenCalled();
 });
 it.each(["received","scheduled","completed"] as const)("sends %s through Graph reply", async kind => {
  m.transaction.mockResolvedValue("token"); m.graph.mockResolvedValue({value:[{id:"id/with+chars"}]}); vi.mocked(fetch).mockResolvedValue({ok:true} as Response);
  await sendClientMail(9,kind,"manager"); expect(fetch).toHaveBeenCalledWith("https://graph.microsoft.com/v1.0/me/messages/id%2Fwith%2Bchars/reply",expect.objectContaining({method:"POST"}));
  expect(m.values).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({kind,ok:true,transport:"graph"})})); expect(m.smtp).not.toHaveBeenCalled();
 });
 it("uses the synthetic Graph message id directly", async () => {
  m.transaction.mockResolvedValue("token"); m.previewOrder.mockResolvedValue({...order,emailMessageId:"graph:office@example.com:opaque-id"}); vi.mocked(fetch).mockResolvedValue({ok:true} as Response);
  await sendClientMail(9,"received","manager"); expect(m.graph).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/opaque-id/reply"),expect.anything());
 });
 it("does not send a new thread when the original Graph message is missing", async () => {
  m.transaction.mockResolvedValue("token"); m.graph.mockResolvedValue({value:[]}); await sendClientMail(9,"received","manager"); expect(fetch).not.toHaveBeenCalled(); expect(m.smtp).not.toHaveBeenCalled(); expect(m.values).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({skipped:"საწყისი წერილი ვერ მოიძებნა"})}));
 });
 it("does not invent SMTP threading for a synthetic Graph id", async () => {
  m.transaction.mockResolvedValue(null); m.previewOrder.mockResolvedValue({...order,emailMessageId:"graph:office@example.com:opaque-id"}); await sendClientMail(9,"received","manager"); expect(m.smtp).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
 });
 it("logs a missing transport", async () => { m.transaction.mockResolvedValue(null); m.configured.mockReturnValue(false); await sendClientMail(9,"scheduled","manager"); expect(m.values).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({skipped:"გაგზავნის არხი არ არის გამართული"})})); expect(m.smtp).not.toHaveBeenCalled(); });
 it("honors the setting being disabled while preparing the transport", async () => { m.transaction.mockResolvedValue("token"); m.enabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false); await sendClientMail(9,"received","manager"); expect(fetch).not.toHaveBeenCalled(); expect(m.smtp).not.toHaveBeenCalled(); });
 it("records SMTP failure without reporting success", async () => { m.transaction.mockResolvedValue(null); m.smtp.mockRejectedValue(new Error("SMTP rejected")); await sendClientMail(9,"completed","manager"); expect(m.values).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({ok:false,error:"SMTP rejected"})})); });
 it.each([null,"Mail.Read","Mail.Send","https://graph.microsoft.com/Mail.Send"])("checks the actual granted scope %s before requesting a token", async scope => {
  m.transaction.mockImplementation(callback => callback({execute:vi.fn(),query:{outlookConnection:{findFirst:async()=>({id:"shared"})},appSettings:{findFirst:async()=>scope ? {value:scope} : undefined}}}));
  m.token.mockResolvedValue(null); await sendClientMail(9,"received","manager"); expect(m.token).toHaveBeenCalledTimes(scope?.endsWith("Mail.Send") ? 1 : 0);
 });
 it("never refreshes a token without a connected mailbox", async () => {
  m.transaction.mockImplementation(callback=>callback({execute:vi.fn(),query:{outlookConnection:{findFirst:async()=>undefined},appSettings:{findFirst:async()=>({value:"Mail.Send"})}}}));
  await sendClientMail(9,"received","manager"); expect(m.token).not.toHaveBeenCalled();
 });
});

describe("portal and manual mail delivery", () => {
 it.each(["received","scheduled","completed"] as const)("uses Graph sendMail and only opted-in contacts for %s", async kind => {
  m.enabled.mockResolvedValue(true); m.transaction.mockResolvedValue("token");
  m.previewOrder.mockResolvedValue({source:"portal",emailFrom:null,number:"LN-11",title:"სამუშაო",scheduledAt:new Date("2026-10-01T06:00:00Z"),completionNote:"მზადაა",amount:"118",vatPercent:"18",items:[],client:{email:"office@example.com"},site:{contacts:[{email:"branch@example.com",receivesEmail:true},{email:"private@example.com",receivesEmail:false}]}});
  const outbound=vi.fn().mockResolvedValue({ok:true}); vi.stubGlobal("fetch",outbound);
  await sendClientMail(11,kind,"manager"); expect(outbound.mock.calls[0][0]).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
  const body=JSON.parse(outbound.mock.calls[0][1].body); expect(body.message.toRecipients).toEqual([{emailAddress:{address:"branch@example.com"}}]); expect(body.saveToSentItems).toBe(true); expect(m.smtp).not.toHaveBeenCalled();
 });
 it("uses unthreaded SMTP for a manual order with company fallback", async () => {
  m.enabled.mockResolvedValue(true); m.transaction.mockResolvedValue(null); m.configured.mockReturnValue(true);
  m.previewOrder.mockResolvedValue({source:"manual",emailFrom:null,number:"LN-12",title:"სამუშაო",scheduledAt:null,completionNote:null,amount:null,vatPercent:"0",items:[],client:{email:"office@example.com"},site:null});
  await sendClientMail(12,"received","manager"); expect(m.smtp).toHaveBeenCalledWith(expect.objectContaining({to:["office@example.com"],inReplyTo:undefined,references:undefined}));
 });
});
