import { describe, expect, it } from "vitest";
import { commentNotification, commentRecipients, withoutAlreadyNotified } from "@/lib/comment-notify";

describe("comment recipients", () => {
  it("never notifies the author", () => {
    expect(commentRecipients({ authorId: "e1", managerId: "m1", staffIds: [], assigneeIds: ["e1", "e2"] })).toEqual(["m1", "e2"]);
    expect(commentRecipients({ authorId: "m1", managerId: "m1", staffIds: [], assigneeIds: ["e1"] })).toEqual(["e1"]);
  });

  it("falls back to every staff member when the order has no manager", () => {
    expect(commentRecipients({ authorId: "e1", managerId: null, staffIds: ["a1", "m1", "m2"], assigneeIds: ["e1", "e2"] })).toEqual(["a1", "m1", "m2", "e2"]);
  });

  it("with a manager, notifies only that manager and the assignees", () => {
    expect(commentRecipients({ authorId: "e1", managerId: "m2", staffIds: ["a1", "m1", "m2"], assigneeIds: ["e1", "e2"] })).toEqual(["m2", "e2"]);
  });

  it("never notifies clients", () => {
    expect(commentRecipients({ authorId: "e1", managerId: null, staffIds: ["m1"], assigneeIds: ["c1", "e2"], clientIds: ["c1"] })).toEqual(["m1", "e2"]);
  });

  it("notifies a manager who is also an assignee once", () => {
    expect(commentRecipients({ authorId: "e1", managerId: "m1", staffIds: [], assigneeIds: ["m1", "e2", "e2"] })).toEqual(["m1", "e2"]);
  });

  it("skips people who still have an unread comment notification", () => {
    expect(withoutAlreadyNotified(["m1", "e2", "e3"], ["e2", "x"])).toEqual(["m1", "e3"]);
    expect(withoutAlreadyNotified(["m1"], [])).toEqual(["m1"]);
  });
});

describe("comment notification text", () => {
  it("names the author and the order", () => {
    const n = commentNotification("ნინო", "LN-00537", "კაბელი მოვიტანე");
    expect(n).toEqual({ type: "comment", title: "ახალი შეტყობინება LN-00537", body: "ნინო: კაბელი მოვიტანე" });
  });

  it("collapses whitespace", () => {
    expect(commentNotification("a", "LN-1", "  ერთი\n\n  ორი\tსამი  ").body).toBe("a: ერთი ორი სამი");
  });

  it("cuts long messages to 80 characters with an ellipsis", () => {
    const body = commentNotification("a", "LN-1", "ა".repeat(200)).body;
    expect(body.length).toBeLessThanOrEqual(83);
    expect(body.endsWith("…")).toBe(true);
    expect(commentNotification("a", "LN-1", "ბ".repeat(80)).body).toBe(`a: ${"ბ".repeat(80)}`);
  });
});
