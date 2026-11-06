import Link from "next/link";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { formatFileSize } from "@/lib/format/fileSize";
import { formatShortDate } from "@/lib/format/shortDate";
import { machineDocumentTypeLabels, type MachineDocument } from "@/lib/types/machineDocument";

interface DocumentsListProps {
  machineId: string;
  documents: MachineDocument[];
  onView: (document: MachineDocument) => void;
  onDelete: (document: MachineDocument) => void;
}

const LINK_BUTTON_CLASSES =
  "inline-flex h-[30px] flex-none items-center gap-1.5 rounded-lg border border-borderGrayStrong px-2.5 text-[13px] font-medium text-ink hover:bg-surfaceGray";

// Scrolls inside its own box on narrow screens.
export const DocumentsList = ({ machineId, documents, onView, onDelete }: DocumentsListProps) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[860px]">
      <TableHeaderRow>
        <TableHeaderCell flex={2.6}>File</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Type</TableHeaderCell>
        <TableHeaderCell flex={1.6}>Added</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Size</TableHeaderCell>
        <TableHeaderCell flex={2.6}>
          <span className="sr-only">Actions</span>
        </TableHeaderCell>
      </TableHeaderRow>
      {documents.map((document) => (
        <TableRow key={document.id}>
          <TableCell flex={2.6}>
            <button
              type="button"
              onClick={() => onView(document)}
              title={document.fileName}
              className="flex max-w-full items-center gap-2 text-left font-medium hover:text-primaryHover"
            >
              <Icon name="file" className="h-4 w-4 flex-none stroke-mutedGray" />
              <span className="truncate">{document.fileName}</span>
            </button>
            {document.historyEntryId && (
              <Link href={`/machines/${machineId}/history`} className="ml-6 text-xs text-mutedGray hover:text-ink">
                Added with a history entry
              </Link>
            )}
          </TableCell>
          <TableCell flex={1.3}>
            <Tag>{machineDocumentTypeLabels[document.documentType]}</Tag>
          </TableCell>
          <TableCell flex={1.6} className="text-[13px]">
            <div>{formatShortDate(document.uploadedAt)}</div>
            <div className="truncate text-xs text-mutedGray">{document.uploadedByName ?? "Deleted account"}</div>
          </TableCell>
          <TableCell flex={0.7} className="text-[13px] text-bodyGray">
            {formatFileSize(document.sizeBytes)}
          </TableCell>
          <TableCell flex={2.6}>
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => onView(document)}>
                <Icon name="eye" className="h-3.5 w-3.5" />
                View
              </Button>
              <a href={document.downloadUrl} className={LINK_BUTTON_CLASSES}>
                <Icon name="download" className="h-3.5 w-3.5" />
                Download
              </a>
              {document.canDelete && (
                <PermissionButton permission={PERMISSIONS.manageMachine} size="sm" variant="ghost" onClick={() => onDelete(document)}>
                  Delete
                </PermissionButton>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </Table>
  </div>
);
