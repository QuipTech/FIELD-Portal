import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";
import { ArticleTocRail } from "./articleTocRail";

afterEach(cleanup);

const ARTICLE: KnowledgeArticle = {
  id: "doc-1",
  title: "CAT 793F Hydraulic System Maintenance Bulletin",
  type: "bulletin",
  machineMake: "CAT",
  machineModel: "793F",
  revision: 1,
  pageCount: 2,
  source: "quiptech_library",
  state: "live",
  fileName: "bulletin.pdf",
  pdfUrl: null,
  summary: null,
  sections: [
    { id: "s0", heading: "1. Purpose", page: 1, content: "Text.", figures: [] },
    { id: "s1", heading: "2. Reported Symptoms", page: 1, content: "Text.", figures: [] },
    { id: "s2", heading: null, page: 2, content: "Text.", figures: [] },
  ],
  related: [{ id: "doc-2", title: "CAT 793F Service Manual", type: "manual", page: 214 }],
  appliesBulletins: [],
};

describe("On this page", () => {
  it("has one link per section, matching the section headings and anchors", () => {
    render(<ArticleTocRail article={ARTICLE} activeSectionId="s0" listContext={{}} onJump={() => undefined} />);
    const links = within(screen.getByRole("navigation", { name: "On this page" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["1. Purpose", "#s0"],
      ["2. Reported Symptoms", "#s1"],
      ["Overview", "#s2"],
    ]);
  });

  it("marks the section in view and jumps to a section when clicked", () => {
    const onJump = vi.fn();
    render(<ArticleTocRail article={ARTICLE} activeSectionId="s1" listContext={{}} onJump={onJump} />);
    expect(screen.getByText("2. Reported Symptoms").getAttribute("aria-current")).toBe("location");
    fireEvent.click(screen.getByText("1. Purpose"));
    expect(onJump).toHaveBeenCalledWith("s0");
  });

  it("links related documents and Ask AI with this document as context", () => {
    render(<ArticleTocRail article={ARTICLE} activeSectionId={null} listContext={{ q: "pump" }} onJump={() => undefined} />);
    expect(screen.getByText(/CAT 793F Service Manual/).closest("a")?.getAttribute("href")).toBe("/knowledge/doc-2?q=pump");
    expect(screen.getByText("Ask AI").closest("a")?.getAttribute("href")).toBe(
      "/assistant?document=doc-1&documentTitle=CAT+793F+Hydraulic+System+Maintenance+Bulletin",
    );
  });
});
