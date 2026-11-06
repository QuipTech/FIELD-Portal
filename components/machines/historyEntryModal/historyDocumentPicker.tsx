"use client";

import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { ENTRY_DOCUMENT_ACCEPT } from "@/lib/types/machineDocument";
import { useMultiFilePicker } from "@/lib/uploads/useFilePicker";
import { MAX_ENTRY_DOCUMENTS } from "./historyEntryDraft";

interface HistoryDocumentPickerProps {
  documents: File[];
  onChange: (documents: File[]) => void;
}

// PDF and Word files going up with the entry, e.g. the service report.
export const HistoryDocumentPicker = ({ documents, onChange }: HistoryDocumentPickerProps) => {
  const picker = useMultiFilePicker(ENTRY_DOCUMENT_ACCEPT, (files) => onChange([...documents, ...files].slice(0, MAX_ENTRY_DOCUMENTS)));

  return (
    <div className="flex flex-col gap-1.5">
      {documents.map((document, index) => (
        <div key={`${document.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-borderGrayStrong px-2.5 py-1.5 text-[13px] text-ink">
          <Icon name="file" className="h-4 w-4 flex-none stroke-mutedGray" />
          <span className="min-w-0 flex-1 truncate">{document.name}</span>
          <button
            type="button"
            aria-label={`Remove ${document.name}`}
            onClick={() => onChange(documents.filter((_, documentIndex) => documentIndex !== index))}
            className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-bodyGray hover:bg-fillGray"
          >
            <Icon name="x" className="h-3 w-3" />
          </button>
        </div>
      ))}
      {documents.length < MAX_ENTRY_DOCUMENTS && (
        <div>
          <Button type="button" size="sm" onClick={picker.open}>
            <Icon name="file" className="h-3.5 w-3.5" />
            Add document
          </Button>
        </div>
      )}
      {picker.input}
    </div>
  );
};
