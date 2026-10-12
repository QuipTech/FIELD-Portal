import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { OrganisationDocument } from "@/lib/api/documentsApi";
import type { KnowledgeResult } from "@/lib/types/knowledgeLibrary";
import { OrganisationDocumentRow } from "./organisationDocumentRow";
import { KnowledgeResultCard } from "./knowledgeResultCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
});

const DOCUMENT: OrganisationDocument = {
  id: "doc-1",
  isShared: true,
  organisationName: null,
  title: "CAT 793F Hydraulic System Maintenance Bulletin",
  type: "bulletin",
  status: "published",
  state: "live",
  ingestionStatus: "ready",
  progress: 100,
  errorMessage: null,
  versionNumber: 1,
  reviewNote: null,
  fileName: "CAT_793F_Hydraulic_System_Maintenance_Bulletin (2).pdf",
  contentType: "application/pdf",
  sizeBytes: 1000,
  pageCount: 2,
  isPageCountPending: false,
  indexedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  downloadUrl: "https://s3.example/doc-1.pdf",
};

const RESULT: KnowledgeResult = {
  id: "doc-1",
  title: "CAT 793F Hydraulic System Maintenance Bulletin",
  type: "bulletin",
  snippet: "Replace the strainer element.",
  page: 2,
  heading: "5. Corrective Action",
  sectionId: "s4",
  models: ["CAT 793F"],
  source: "shared",
  sourceOem: null,
  versionNumber: 1,
  updatedAt: "2026-10-01T00:00:00Z",
};

describe("Documents card row", () => {
  it("opens the article, keeping the search in the URL", () => {
    render(<OrganisationDocumentRow document={DOCUMENT} listContext={{ q: "strainer" }} />);
    fireEvent.click(screen.getByText(DOCUMENT.title));
    expect(push).toHaveBeenCalledWith("/knowledge/doc-1?q=strainer");
  });

  it("shows the clean title, with the file name in the meta line", () => {
    render(<OrganisationDocumentRow document={DOCUMENT} listContext={{}} />);
    expect(screen.getByText(DOCUMENT.title)).toBeTruthy();
    expect(screen.getByText(/CAT_793F_Hydraulic_System_Maintenance_Bulletin \(2\)\.pdf/)).toBeTruthy();
  });

  it("doesn't open the article from Download or the tags", () => {
    render(<OrganisationDocumentRow document={DOCUMENT} listContext={{}} />);
    const download = screen.getByLabelText(`Download ${DOCUMENT.title}`);
    // jsdom can't follow the real link; the row must still ignore the click.
    download.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(download);
    fireEvent.click(screen.getByText("Shared"));
    fireEvent.click(screen.getByText("Live"));
    expect(push).not.toHaveBeenCalled();
  });

  it("opens with Enter from the keyboard", () => {
    render(<OrganisationDocumentRow document={DOCUMENT} listContext={{}} />);
    fireEvent.keyDown(screen.getByRole("link", { name: `Open ${DOCUMENT.title}` }), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/knowledge/doc-1");
  });
});

describe("Search result card", () => {
  it("opens the article at the matching section, with the search kept", () => {
    render(<KnowledgeResultCard result={RESULT} listContext={{ q: "strainer", type: "bulletin" }} />);
    fireEvent.click(screen.getByText(RESULT.title));
    expect(push).toHaveBeenCalledWith("/knowledge/doc-1?q=strainer&type=bulletin&section=s4");
  });

  it("shows the matched page, not page 1", () => {
    render(<KnowledgeResultCard result={RESULT} listContext={{}} />);
    expect(screen.getByText("CAT 793F · p. 2 · Rev 1")).toBeTruthy();
  });

  it("doesn't open the article from its tags", () => {
    render(<KnowledgeResultCard result={RESULT} listContext={{}} />);
    fireEvent.click(screen.getByText("QuipTech library"));
    expect(push).not.toHaveBeenCalled();
  });
});
