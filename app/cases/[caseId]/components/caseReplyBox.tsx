"use client";

import { useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { CaseStatus } from "@/lib/types/supportCase";

interface CaseReplyBoxProps {
  status: CaseStatus;
  typingName: string | null;
  onSend: (body: string) => Promise<void>;
  onTyping: () => void;
  onStatusChange: (status: CaseStatus) => Promise<void>;
}

// Replies send with the button or Ctrl/⌘+Enter. A resolved case must be
// reopened before anyone can reply.
export const CaseReplyBox = ({ status, typingName, onSend, onTyping, onStatusChange }: CaseReplyBoxProps) => {
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isResolved = status === "resolved";

  const run = async (action: () => Promise<void>, failedMessage: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(toApiErrorMessage(actionError, failedMessage));
    } finally {
      setIsBusy(false);
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body || isBusy) return;
    return run(async () => {
      await onSend(body);
      setDraft("");
    }, "Couldn't send your reply. Please try again.");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="mt-auto flex flex-col gap-2">
      <span className="h-4 text-xs text-mutedGray">{typingName ? `${typingName} is typing…` : ""}</span>
      <textarea
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onTyping();
        }}
        onKeyDown={handleKeyDown}
        disabled={isResolved}
        maxLength={5000}
        aria-label="Reply"
        placeholder={isResolved ? "This case is resolved. Reopen it to reply." : "Write a reply…"}
        className="resize-none rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray disabled:bg-fillGray"
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex items-center">
        <PermissionButton
          permission={PERMISSIONS.raiseSupportCase}
          variant="primary"
          onClick={send}
          disabled={isBusy || isResolved || !draft.trim()}
        >
          <Icon name="send" />
          Send reply
        </PermissionButton>
        <PermissionButton
          permission={PERMISSIONS.manageSupportCases}
          className="ml-auto"
          disabled={isBusy}
          onClick={() =>
            run(() => onStatusChange(isResolved ? "open" : "resolved"), "Couldn't update the case. Please try again.")
          }
        >
          {isResolved ? "Reopen case" : "Resolve case"}
        </PermissionButton>
      </div>
    </div>
  );
};
