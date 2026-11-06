"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { DocumentViewer, type ViewableDocument } from "@/components/machines/documentViewer/documentViewer";
import type { HistoryDocument } from "@/lib/types/historyEntry";

const CHIP_CLASSES = "inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-borderGrayStrong px-2.5 py-1 text-xs text-ink";

// The files added with an entry. Each opens in the viewer; one still waiting
// to reach the server can't be opened yet.
export const HistoryEntryDocuments = ({ documents }: { documents: HistoryDocument[] }) => {
  const [viewing, setViewing] = useState<ViewableDocument | null>(null);
  if (documents.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {documents.map((document) => {
        const label = (
          <>
            <Icon name="file" className="h-3.5 w-3.5 flex-none stroke-mutedGray" />
            <span className="truncate">{document.fileName}</span>
          </>
        );
        const { url, downloadUrl } = document;
        return url && downloadUrl ? (
          <button
            key={document.id}
            type="button"
            onClick={() => setViewing({ fileName: document.fileName, contentType: document.contentType, url, downloadUrl })}
            className={`${CHIP_CLASSES} hover:bg-surfaceGray`}
          >
            {label}
          </button>
        ) : (
          <span key={document.id} className={CHIP_CLASSES}>
            {label}
          </span>
        );
      })}
      {viewing && <DocumentViewer document={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};
