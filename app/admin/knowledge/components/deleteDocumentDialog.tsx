import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { KnowledgeDocument } from "@/lib/types/adminDocument";

interface DeleteDocumentDialogProps {
  document: KnowledgeDocument;
  onDelete: (documentId: string) => Promise<void>;
  onClose: () => void;
}

const DELETE_FAILED_MESSAGE = "Couldn't delete the document. Please try again.";

export const DeleteDocumentDialog = ({ document, onDelete, onClose }: DeleteDocumentDialogProps) => (
  <ConfirmDialog
    title="Delete document"
    confirmLabel="Delete permanently"
    onConfirm={() => onDelete(document.id)}
    onClose={onClose}
    toErrorMessage={(error) => toApiErrorMessage(error, DELETE_FAILED_MESSAGE)}
  >
    Permanently delete <span className="font-medium text-ink">{document.title}</span>? Every version, its stored
    files and its AI search index are removed, and every organisation loses access. This can&apos;t be undone; the
    deletion is recorded in the audit log.
  </ConfirmDialog>
);
