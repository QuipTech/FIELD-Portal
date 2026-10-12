import { describe, expect, it } from "vitest";
import { buildArticleHref, buildKnowledgeListHref, readListContext, toListContext } from "./knowledgeLinks";

describe("knowledge links", () => {
  it("keeps the search and filters between the list and an article", () => {
    const context = toListContext({ search: " strainer ", type: "bulletin", make: "", model: "m-1" });
    expect(context).toEqual({ q: "strainer", type: "bulletin", model: "m-1" });
    const articleHref = buildArticleHref("doc-1", context, "s3");
    expect(articleHref).toBe("/knowledge/doc-1?q=strainer&type=bulletin&model=m-1&section=s3");
    const back = readListContext(new URLSearchParams(articleHref.split("?")[1]));
    expect(buildKnowledgeListHref(back)).toBe("/knowledge?q=strainer&type=bulletin&model=m-1");
  });

  it("has no query string with no filters", () => {
    expect(buildKnowledgeListHref({})).toBe("/knowledge");
    expect(buildArticleHref("doc-1", {})).toBe("/knowledge/doc-1");
  });
});
