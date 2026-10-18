import { describe, expect, it } from "vitest";
import { categoryOptions } from "./categoryOptions";
import { toSlug } from "./toSlug";
import type { KnowledgeCategory } from "../types/knowledgeBrand";

const category = (id: string, name: string, parentId: string | null = null): KnowledgeCategory => ({
  id,
  brandId: "brand",
  parentId,
  name,
  slug: toSlug(name),
  sortOrder: 0,
});

describe("categoryOptions", () => {
  it("lists each parent followed by its subfolders, with path and depth", () => {
    const options = categoryOptions([
      category("a", "Machine maintenance"),
      category("b", "Technical bulletins"),
      category("c", "Engine", "a"),
      category("d", "Turbo", "c"),
    ]);
    expect(options.map(({ label, depth }) => [label, depth])).toEqual([
      ["Machine maintenance", 0],
      ["Machine maintenance / Engine", 1],
      ["Machine maintenance / Engine / Turbo", 2],
      ["Technical bulletins", 0],
    ]);
  });

  it("still lists categories caught in a parent cycle", () => {
    const options = categoryOptions([category("a", "A", "b"), category("b", "B", "a")]);
    expect(options.map((option) => option.id).sort()).toEqual(["a", "b"]);
  });
});

describe("toSlug", () => {
  it("turns a name into a URL-safe slug", () => {
    expect(toSlug("Machine maintenance")).toBe("machine-maintenance");
    expect(toSlug("  Parts & Service  Bulletins! ")).toBe("parts-and-service-bulletins");
    expect(toSlug("Câterpillar")).toBe("caterpillar");
  });
});
