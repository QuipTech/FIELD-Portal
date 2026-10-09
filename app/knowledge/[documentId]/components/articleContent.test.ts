import { describe, expect, it } from "vitest";
import { toContentBlocks } from "./articleContent";

describe("toContentBlocks", () => {
  it("groups bullets into a list between paragraphs", () => {
    expect(toContentBlocks("Intro.\n\n• Slow raise.\n\n• Pump whine.\n\nOutro.")).toEqual([
      { kind: "paragraph", text: "Intro." },
      { kind: "list", items: ["Slow raise.", "Pump whine."] },
      { kind: "paragraph", text: "Outro." },
    ]);
  });
});
