import { abbreviateName } from "@/lib/format/nameInitials";
import { formatMessageTimestamp } from "@/components/supportCases/caseThread/messageTimestamp";
import type { CaseMessage } from "@/lib/types/caseMessage";

// Staff-only notes on the case, newest first under the note box. They
// stay out of the chat; customers never receive them.
export const InternalNotesList = ({ notes }: { notes: CaseMessage[] }) => {
  if (notes.length === 0) {
    return <span className="text-sm text-indigo-200/50">No notes yet.</span>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {[...notes].reverse().map((note) => (
        <li key={note.id} className="flex flex-col gap-1 rounded-lg bg-white/10 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs text-indigo-200/60">
            <span className="font-medium text-indigo-100">{abbreviateName(note.author?.name ?? "Former user")}</span>
            {formatMessageTimestamp(note.createdAt)}
          </span>
          <p className="whitespace-pre-wrap break-words text-sm text-white">{note.body}</p>
        </li>
      ))}
    </ul>
  );
};
