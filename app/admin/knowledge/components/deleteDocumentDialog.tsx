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
    confirmLabel="Delete"
    onConfirm={() => onDelete(document.id)}
    onClose={onClose}
    toErrorMessage={(error) => toApiErrorMessage(error, DELETE_FAILED_MESSAGE)}
  >
    Remove <span className="font-medium text-ink">{document.title}</span> from the knowledge library? Every
    organisation loses access to it. This is recorded in the audit log.
  </ConfirmDialog>
);
