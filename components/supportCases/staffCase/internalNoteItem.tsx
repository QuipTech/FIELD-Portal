"use client";

import { useState } from "react";
import { ActionMenu } from "@/components/ui/actionMenu";
import { Button } from "@/components/ui/button";
import { formatMessageTimestamp } from "@/components/supportCases/caseThread/messageTimestamp";
import { abbreviateName } from "@/lib/format/nameInitials";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { CaseMessage } from "@/lib/types/caseMessage";

interface InternalNoteItemProps {
  note: CaseMessage;
  // The note's author or the support admin.
  canChange: boolean;
  onSave: (body: string) => Promise<void>;
  onDelete: () => void;
}

const MENU_TRIGGER = {
  content: (
    <>
      <span aria-hidden>⋯</span>
      <span className="sr-only">Note actions</span>
    </>
  ),
  className: "flex h-6 w-6 items-center justify-center rounded-md text-indigo-200/70 hover:bg-white/10 hover:text-white",
};

// One note in the panel; its author (or the admin) edits it in place.
export const InternalNoteItem = ({ note, canChange, onSave, onDelete }: InternalNoteItemProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditing = draft !== null;

  const save = async () => {
    if (!draft?.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(draft.trim());
      setDraft(null);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't save the note. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <li className="flex flex-col gap-1 rounded-lg bg-white/10 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-indigo-200/60">
        <span className="font-medium text-indigo-100">{abbreviateName(note.author?.name ?? "Former user")}</span>
        {formatMessageTimestamp(note.createdAt)}
        {note.editedAt && <span>· edited</span>}
        {canChange && !isEditing && (
          <span className="ml-auto">
            <ActionMenu
              label="note"
              trigger={MENU_TRIGGER}
              items={[
                { label: "Edit", icon: "file", onSelect: () => setDraft(note.body) },
                { label: "Delete", icon: "x", tone: "danger", onSelect: onDelete },
              ]}
            />
          </span>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={5000}
            aria-label="Edit note"
            autoFocus
            className="resize-none rounded-lg border border-amberBorder bg-amberTint px-3 py-2 text-sm text-ink outline-none"
          />
          {saveError && <span className="text-xs text-red-300">{saveError}</span>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="text-indigo-100" onClick={() => setDraft(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={isSaving || !draft.trim()}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm text-white">{note.body}</p>
      )}
    </li>
  );
};
