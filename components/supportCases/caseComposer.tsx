"use client";

import { useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useCaseAttachmentUploads } from "@/lib/hooks/useCaseAttachmentUploads";
import type { CaseThreadScope } from "@/lib/api/caseThreadApi";
import type { NewCaseMessage } from "@/lib/types/caseMessage";
import { CaseAttachmentPicker } from "./caseAttachmentPicker";

const BAR_CLASSES = "flex-none border-t border-borderGray bg-surface px-6 py-4";

interface CaseComposerProps {
  scope: CaseThreadScope;
  caseNumber: number;
  typingName: string | null;
  // Why writing is closed (e.g. resolved), or null when it's open.
  closedReason: string | null;
  // Staff only: a note only support staff see, shown amber.
  isInternal?: boolean;
  // False hides the photo/file buttons (e.g. internal notes).
  allowAttachments?: boolean;
  hint?: string;
  // Replaces the bar look under the thread (e.g. a card in the staff panel).
  className?: string;
  onSend: (message: NewCaseMessage) => Promise<void>;
  onTyping: (isInternal: boolean) => void;
  onError: (message: string) => void;
}

// A reply or internal-note box. Sends with the button or Ctrl/⌘+Enter.
export const CaseComposer = ({
  scope,
  caseNumber,
  typingName,
  closedReason,
  isInternal = false,
  allowAttachments = true,
  hint = "",
  className = BAR_CLASSES,
  onSend,
  onTyping,
  onError,
}: CaseComposerProps) => {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const uploads = useCaseAttachmentUploads(scope, scope === "staff" ? caseNumber : null);
  const isClosed = closedReason !== null;
  const canSend = !isClosed && !isSending && !uploads.isUploading && draft.trim().length > 0;

  const send = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      await onSend({ body: draft.trim(), isInternal: isInternal || undefined, attachmentIds: uploads.attachmentIds });
      setDraft("");
      uploads.clear();
    } catch (error) {
      onError(toApiErrorMessage(error, "Couldn't send your message. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  };

  const placeholder = isClosed
    ? (closedReason ?? "")
    : isInternal
      ? "Add an internal note — only support staff can see it…"
      : "Write a reply…";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {(typingName || hint) && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-mutedGray">{typingName ? `${typingName} is typing…` : ""}</span>
          <span className="ml-auto text-sm text-mutedGray">{hint}</span>
        </div>
      )}
      <textarea
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onTyping(isInternal);
        }}
        onKeyDown={handleKeyDown}
        disabled={isClosed}
        maxLength={5000}
        aria-label={isInternal ? "Internal note" : "Reply"}
        placeholder={placeholder}
        className={`resize-none rounded-xl border px-4 py-3 text-[16px] text-ink outline-none placeholder:text-mutedGray disabled:bg-fillGray ${
          isInternal ? "border-amberBorder bg-amberTint" : "border-borderGrayStrong bg-surface"
        }`}
      />
      <div className="flex items-center gap-2">
        {allowAttachments && (
          <CaseAttachmentPicker uploads={uploads.uploads} onAdd={uploads.addFiles} onRemove={uploads.remove} disabled={isClosed} />
        )}
        <Button variant="primary" size={isInternal ? "md" : "lg"} className="ml-auto" onClick={send} disabled={!canSend}>
          <Icon name="send" />
          {isInternal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </div>
  );
};
