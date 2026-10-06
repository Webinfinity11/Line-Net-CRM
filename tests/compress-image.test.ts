import { describe, expect, it } from "vitest";
import { targetSize } from "@/lib/compress-image";

describe("photo shrinking before upload", () => {
  it("scales the long side down to 1600px and keeps the proportions", () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });
  it("never enlarges a small picture", () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
