"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface PromptEditorModalProps {
  initialBody: string;
  onSave: (body: string, notes: string) => Promise<void>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the prompt. Please try again.";
const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

// Saving adds a new version and makes it live for every organisation.
export const PromptEditorModal = ({ initialBody, onSave, onClose }: PromptEditorModalProps) => {
  const [body, setBody] = useState(initialBody);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isUnchanged = body.trim() === initialBody.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(body.trim(), notes.trim());
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit prompt" onClose={isSaving ? undefined : onClose} widthClassName="w-[720px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>System prompt</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={16}
            required
            autoFocus
            className="rounded-lg border border-borderGrayStrong bg-surface p-3 font-mono text-[13px] text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>What changed (optional)</span>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
        </label>
        <span className="text-xs text-mutedGray">
          Saving publishes a new version to every organisation straight away.
        </span>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="ml-auto"
            disabled={!body.trim() || isUnchanged || isSaving}
          >
            {isSaving ? "Saving…" : "Save & publish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
