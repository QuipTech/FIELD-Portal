"use client";

import { useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useCaseAttachmentUploads } from "@/lib/hooks/useCaseAttachmentUploads";
import type { CaseThreadScope } from "@/lib/api/caseThreadApi";
import type { NewCaseMessage } from "@/lib/types/caseMessage";
import { CaseAttachmentPicker } from "./caseAttachmentPicker";
import { ComposerModeToggle, type ComposerMode } from "./composerModeToggle";

interface CaseComposerProps {
  scope: CaseThreadScope;
  caseNumber: number;
  typingName: string | null;
  // Why replying is closed (e.g. resolved), or null when it's open.
  replyClosedReason: string | null;
  // Staff only: internal notes stay open until the case is closed.
  canAddInternalNotes?: boolean;
  onSend: (message: NewCaseMessage) => Promise<void>;
  onTyping: (isInternal: boolean) => void;
  onError: (message: string) => void;
}

// The reply box under the thread. Sends with the button or Ctrl/⌘+Enter.
export const CaseComposer = ({
  scope,
  caseNumber,
  typingName,
  replyClosedReason,
  canAddInternalNotes = false,
  onSend,
  onTyping,
  onError,
}: CaseComposerProps) => {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ComposerMode>(replyClosedReason && canAddInternalNotes ? "internal" : "reply");
  const [isSending, setIsSending] = useState(false);
  const uploads = useCaseAttachmentUploads(scope, scope === "staff" ? caseNumber : null);
  const isInternal = mode === "internal";
  const isClosed = isInternal ? !canAddInternalNotes : replyClosedReason !== null;
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

  const hint = isInternal
    ? "Only support staff can see internal notes"
    : canAddInternalNotes
      ? "Customer sees replies in the portal and gets an email"
      : "";

  const placeholder = isClosed
    ? (replyClosedReason ?? "")
    : isInternal
      ? "Add an internal note — only support staff can see it…"
      : "Write a reply…";

  return (
    <div className="flex flex-none flex-col gap-3 border-t border-borderGray bg-surface px-6 py-4">
      <div className="flex items-center gap-3">
        {canAddInternalNotes && <ComposerModeToggle mode={mode} onChange={setMode} />}
        <span className="text-xs text-mutedGray">{typingName ? `${typingName} is typing…` : ""}</span>
        <span className="ml-auto text-sm text-mutedGray">{hint}</span>
      </div>
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
        <CaseAttachmentPicker uploads={uploads.uploads} onAdd={uploads.addFiles} onRemove={uploads.remove} disabled={isClosed} />
        <Button variant="primary" size="lg" className="ml-auto" onClick={send} disabled={!canSend}>
          <Icon name="send" />
          {isInternal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </div>
  );
};
