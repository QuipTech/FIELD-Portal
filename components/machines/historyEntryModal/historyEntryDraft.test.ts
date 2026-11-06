import { describe, expect, it } from "vitest";
import { toPendingHistoryEntry } from "@/lib/machineDetail/toPendingHistoryEntry";
import { toNewHistoryEntry, validateHistoryEntryDraft, type HistoryEntryDraft } from "./historyEntryDraft";

const draft = (documents: File[]): HistoryEntryDraft => ({
  type: "inspection",
  componentId: "",
  componentReplaced: false,
  description: "Annual inspection",
  photos: [],
  documents,
  hours: "",
  downtime: "",
});

const fileOfSize = (name: string, size: number) => {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("history entry documents", () => {
  it("refuses a document over 20 MB", () => {
    const errors = validateHistoryEntryDraft(draft([fileOfSize("big.pdf", 20 * 1024 * 1024 + 1)]));
    expect(errors.documents).toBe("Each document must be 20 MB or smaller.");
  });

  it("passes documents on to the new entry", () => {
    const report = fileOfSize("report.pdf", 1024);
    expect(validateHistoryEntryDraft(draft([report]))).toEqual({});
    expect(toNewHistoryEntry(draft([report]), []).documents).toEqual([report]);
  });

  it("shows a pending entry's documents without a link", () => {
    const entry = toNewHistoryEntry(draft([fileOfSize("report.pdf", 1024)]), []);
    expect(toPendingHistoryEntry("p1", entry, "saving").documents).toEqual([
      { id: "p1-document-0", fileName: "report.pdf", contentType: "application/pdf", url: null, downloadUrl: null },
    ]);
  });

  it("treats an entry queued before documents existed as having none", () => {
    const { documents: _documents, ...queued } = toNewHistoryEntry(draft([]), []);
    expect(toPendingHistoryEntry("p2", queued, "offline").documents).toEqual([]);
  });
});
