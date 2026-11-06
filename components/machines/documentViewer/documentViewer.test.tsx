import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentViewer } from "./documentViewer";
import { toDocumentViewKind } from "./documentViewKind";
import { renderDocx } from "./renderDocx";

afterEach(cleanup);

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const viewable = (contentType: string, fileName = "report") => ({
  fileName,
  contentType,
  url: "https://signed/open",
  downloadUrl: "https://signed/save",
});

// The smallest Word file: one paragraph.
const buildDocx = async (text: string): Promise<Blob> => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${DOCX}.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "blob", mimeType: DOCX });
};

describe("toDocumentViewKind", () => {
  it("covers every type the Documents tab accepts", () => {
    expect(toDocumentViewKind("application/pdf")).toBe("pdf");
    expect(toDocumentViewKind("image/jpeg")).toBe("image");
    expect(toDocumentViewKind("image/png")).toBe("image");
    expect(toDocumentViewKind("image/heic")).toBe("heic");
    expect(toDocumentViewKind(DOCX)).toBe("docx");
    expect(toDocumentViewKind("application/msword")).toBe("none");
  });
});

describe("renderDocx", () => {
  it("draws a Word file's text", async () => {
    const target = document.createElement("div");
    const styles = document.createElement("div");
    await renderDocx(await buildDocx("Annual inspection passed"), target, styles);
    expect(target.textContent).toContain("Annual inspection passed");
  });
});

describe("DocumentViewer", () => {
  it("shows a PDF in a frame and an image directly", () => {
    render(<DocumentViewer document={viewable("application/pdf", "a.pdf")} onClose={vi.fn()} />);
    expect(screen.getByTitle("a.pdf").getAttribute("src")).toBe("https://signed/open");
    cleanup();
    render(<DocumentViewer document={viewable("image/png", "b.png")} onClose={vi.fn()} />);
    expect(screen.getByAltText("b.png").getAttribute("src")).toBe("https://signed/open");
  });

  it("offers an old .doc as a download, with its proper link", () => {
    render(<DocumentViewer document={viewable("application/msword")} onClose={vi.fn()} />);
    expect(screen.getByText("No preview for this file")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe("https://signed/save");
  });

  it("turns scripts off in a Word file's frame", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<DocumentViewer document={viewable(DOCX, "c.docx")} onClose={vi.fn()} />);
    expect(screen.getByTitle("c.docx").getAttribute("sandbox")).toBe("allow-same-origin");
    vi.unstubAllGlobals();
  });

  it("closes on Escape and the close button", () => {
    const onClose = vi.fn();
    render(<DocumentViewer document={viewable("application/pdf")} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
