import { describe, expect, it } from "vitest";
import { completionRecipients, completionTexts, clientCompletedText, clientClosedText } from "@/lib/completion-notify";
import { portalStatusLabel } from "@/lib/i18n";

describe("completion recipients", () => {
  const input = { managerId: "manager", staffIds: ["manager", "other", "admin"], adminIds: ["admin", "admin2"], actorId: "executor" };
  it("uses the order manager and all admins", () => {
    expect(completionRecipients(input)).toEqual(["manager", "admin", "admin2"]);
  });
  it("falls back to all staff and removes duplicates", () => {
    expect(completionRecipients({ ...input, managerId: null })).toEqual(["manager", "other", "admin", "admin2"]);
  });
  it("excludes an admin author even when they manage the order", () => {
    expect(completionRecipients({ ...input, managerId: "admin", actorId: "admin" })).toEqual(["admin2"]);
  });
  it("excludes the author in the staff fallback", () => {
    expect(completionRecipients({ ...input, managerId: null, actorId: "manager" })).toEqual(["other", "admin", "admin2"]);
  });
});

describe("completion texts", () => {
  const input = { number: "LN-00107", siteName: "ვერე", actorName: "გიორგი" };
  it.each([true, false])("distinguishes partial=%s handover", (partial) => {
    expect(completionTexts({ ...input, partial })).toEqual({
      title: "ჩაბარდა LN-00107 · ვერე",
      body: `შემსრულებელი: გიორგი · ${partial ? "ნაწილი" : "სამუშაო დასრულებულია"}`,
    });
  });
  it("tells the client that completed work is being checked", () => {
    expect(clientCompletedText(input)).toEqual({ title: "LN-00107 ჩაბარდა · ვერე", body: "შემსრულებელი: გიორგი · მენეჯერი ამოწმებს" });
  });
  it("confirms closure with the portal wording", () => {
    expect(clientClosedText(input)).toEqual({ title: "LN-00107 შესრულებულია · ვერე", body: "სამუშაო დადასტურებულია" });
    expect(portalStatusLabel("closed", true)).toBe("შესრულებულია");
  });
  it("handles missing sites in every notification", () => {
    const missing = { ...input, siteName: null };
    expect(completionTexts({ ...missing, partial: true }).title).toBe("ჩაბარდა LN-00107 · —");
    expect(clientCompletedText(missing).title).toBe("LN-00107 ჩაბარდა · —");
    expect(clientClosedText(missing).title).toBe("LN-00107 შესრულებულია · —");
  });
});
