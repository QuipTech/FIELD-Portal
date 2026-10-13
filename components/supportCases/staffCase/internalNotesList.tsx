"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { CaseMessage } from "@/lib/types/caseMessage";
import { InternalNoteItem } from "./internalNoteItem";

interface InternalNotesListProps {
  notes: CaseMessage[];
  currentUserId: string | null;
  isAdmin: boolean;
  onUpdate: (noteId: string, body: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

// Staff-only notes on the case, newest first under the note box. They
// stay out of the chat; customers never receive them.
export const InternalNotesList = ({ notes, currentUserId, isAdmin, onUpdate, onDelete }: InternalNotesListProps) => {
  const [noteToDelete, setNoteToDelete] = useState<CaseMessage | null>(null);

  if (notes.length === 0) {
    return <span className="text-sm text-indigo-200/50">No notes yet.</span>;
  }
  return (
    <>
      <ul className="flex flex-col gap-2">
        {[...notes].reverse().map((note) => (
          <InternalNoteItem
            key={note.id}
            note={note}
            canChange={isAdmin || (currentUserId !== null && note.author?.id === currentUserId)}
            onSave={(body) => onUpdate(note.id, body)}
            onDelete={() => setNoteToDelete(note)}
          />
        ))}
      </ul>
      {noteToDelete && (
        <ConfirmDialog
          title="Delete note"
          confirmLabel="Delete note"
          onConfirm={() => onDelete(noteToDelete.id)}
          onClose={() => setNoteToDelete(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the note. Please try again.")}
        >
          Delete this internal note? Other support staff will no longer see it.
        </ConfirmDialog>
      )}
    </>
  );
};
