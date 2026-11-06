"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { EmptyState } from "@/components/ui/emptyState";
import { DocxPreview, HeicPreview } from "./convertedPreviews";
import { toDocumentViewKind } from "./documentViewKind";

export interface ViewableDocument {
  fileName: string;
  contentType: string;
  // Signed, valid 15 minutes.
  url: string;
  downloadUrl: string;
}

interface DocumentViewerProps {
  document: ViewableDocument;
  onClose: () => void;
}

const NOT_SHOWABLE_DESCRIPTIONS = {
  legacyWord: "Older Word (.doc) files can't be shown in the browser. Download it to open it in Word.",
  failed: "Close this and try again, or download it instead.",
};

// Any machine document, over the page. Everything is drawn in the browser, so
// the file never goes to an outside viewing service.
export const DocumentViewer = ({ document: file, onClose }: DocumentViewerProps) => {
  const [hasFailed, setHasFailed] = useState(false);
  const handleFailed = useCallback(() => setHasFailed(true), []);
  const kind = toDocumentViewKind(file.contentType);
  const canShow = kind !== "none" && !hasFailed;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={file.fileName} className="fixed inset-0 z-40 flex flex-col gap-3 bg-inkStatic/90 p-4" onClick={onClose}>
      <div className="flex items-center gap-3 text-sm text-white" onClick={(event) => event.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate font-medium">{file.fileName}</span>
        <a href={file.downloadUrl} className="flex flex-none items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1.5 text-[13px] hover:bg-white/10">
          <Icon name="download" className="h-3.5 w-3.5 stroke-white" />
          Download
        </a>
        <button type="button" aria-label="Close" onClick={onClose} className="flex-none">
          <Icon name="x" className="stroke-white" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-surface" onClick={(event) => event.stopPropagation()}>
        {!canShow && (
          <EmptyState
            icon="file"
            title={hasFailed ? "Couldn't show this file" : "No preview for this file"}
            description={hasFailed ? NOT_SHOWABLE_DESCRIPTIONS.failed : NOT_SHOWABLE_DESCRIPTIONS.legacyWord}
            className="h-full"
          />
        )}
        {canShow && kind === "pdf" && <iframe src={file.url} title={file.fileName} className="h-full w-full" />}
        {canShow && kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.fileName} onError={handleFailed} className="h-full w-full object-contain" />
        )}
        {canShow && kind === "heic" && <HeicPreview url={file.url} fileName={file.fileName} onFailed={handleFailed} />}
        {canShow && kind === "docx" && <DocxPreview url={file.url} fileName={file.fileName} onFailed={handleFailed} />}
      </div>
    </div>
  );
};
