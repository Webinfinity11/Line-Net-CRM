import { describe, expect, it } from "vitest";
import { completionProblems } from "@/lib/completion-gates";

const note = "სამუშაო შესრულდა";
const photo = { mimeType: "image/jpeg", uploadedBy: "executor-a" };
describe("completion gates", () => {
  it("requires a meaningful note, a photo and all required items", () => {
    expect(completionProblems({ note: "   ", attachments: [], checklist: [{ label: "ტესტი", required: true, done: false }] })).toHaveLength(3);
  });
  it("only counts the executor's own image", () => {
    expect(completionProblems({ note, attachments: [photo], checklist: [], executorId: "executor-b" })).toEqual(["დაამატეთ ერთი ფოტო მაინც"]);
    expect(completionProblems({ note, attachments: [photo], checklist: [], executorId: "executor-a" })).toEqual([]);
  });
  it("staff may use any order photo, including a deleted uploader's photo", () => {
    expect(completionProblems({ note, attachments: [{ ...photo, uploadedBy: null }], checklist: [] })).toEqual([]);
  });
  it("does not count PDFs or missing MIME types as photos", () => {
    expect(completionProblems({ note, attachments: [{ mimeType: "application/pdf" }, { mimeType: null }], checklist: [] })).toEqual(["დაამატეთ ერთი ფოტო მაინც"]);
  });
  it("names only unchecked required items, optional items do not block", () => {
    expect(completionProblems({ note, attachments: [photo], checklist: [
      { label: "პანელი", required: true, done: false },
      { label: "ტესტი", required: true, done: false },
      { label: "კაბელი", required: true, done: true },
      { label: "შენიშვნა", required: false, done: false },
    ] })).toEqual(["მონიშნეთ სავალდებულო პუნქტები: პანელი, ტესტი"]);
  });
  it("accepts an empty checklist and completed required items", () => {
    expect(completionProblems({ note, attachments: [photo], checklist: [] })).toEqual([]);
    expect(completionProblems({ note, attachments: [photo], checklist: [{ label: "ტესტი", required: true, done: true }] })).toEqual([]);
  });
});

describe("staff completion", () => {
  it("asks staff only for the note", () => {
    const checklist = [{ label: "ტესტი", required: true, done: false }];
    expect(completionProblems({ note: "დასრულდა ტელეფონით", attachments: [], checklist, staff: true })).toEqual([]);
    expect(completionProblems({ note: "", attachments: [], checklist, staff: true })).toHaveLength(1);
  });
});
