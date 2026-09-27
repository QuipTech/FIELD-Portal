import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/iconTile";
import { IconButton } from "@/components/ui/iconButton";
import { Tag } from "@/components/ui/tag";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { formatDocumentIndexedLabel } from "@/lib/format/documentIndexedLabel";
import {
  documentStateLabel,
  documentStateTone,
  documentTypeIcon,
  knowledgeDocumentTypes,
  type KnowledgeDocument,
} from "@/lib/types/adminDocument";

interface DocumentsTableProps {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  loadError: string | null;
  onDownload: (document: KnowledgeDocument) => void;
  onDelete: (document: KnowledgeDocument) => void;
}

const FAILED_ICON = { icon: "x", tone: "danger" } as const;

const typeLabel = (type: string) =>
  knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type.replace(/_/g, " ");

const TableMessage = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-center gap-2 p-10 text-sm text-mutedGray">{children}</div>
);

export const DocumentsTable = ({ documents, isLoading, loadError, onDownload, onDelete }: DocumentsTableProps) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3.2}>Document</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Type</TableHeaderCell>
        <TableHeaderCell flex={1}>Indexed</TableHeaderCell>
        <TableHeaderCell flex={0.5}>Pages</TableHeaderCell>
        <TableHeaderCell flex={0.7}>State</TableHeaderCell>
        <TableHeaderCell flex={0.6}>{""}</TableHeaderCell>
      </TableHeaderRow>
      {loadError && <TableMessage><span className="text-danger">{loadError}</span></TableMessage>}
      {!loadError && isLoading && <TableMessage><LoadingSpinner /> Loading documents…</TableMessage>}
      {!loadError && !isLoading && documents.length === 0 && (
        <TableMessage>No documents yet. Upload a manual, bulletin or procedure to start the library.</TableMessage>
      )}
      {!loadError &&
        documents.map((document) => {
          const { icon, tone } = document.state === "failed" ? FAILED_ICON : documentTypeIcon[document.type] ?? documentTypeIcon.manual;
          const isFileStored = document.state !== "uploading";
          return (
            <TableRow key={document.id}>
              <TableCell flex={3.2} className="flex items-center gap-2.5">
                <IconTile icon={icon} tone={tone} size="sm" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{document.title}</span>
                  {document.fileName && <span className="truncate text-xs text-mutedGray">{document.fileName}</span>}
                </div>
              </TableCell>
              <TableCell flex={0.8} className="text-bodyGray">{typeLabel(document.type)}</TableCell>
              <TableCell flex={1} className="text-xs text-mutedGray">{formatDocumentIndexedLabel(document)}</TableCell>
              <TableCell flex={0.5} className="text-bodyGray">
                {document.isPageCountPending ? (
                  <span className="text-xs text-mutedGray">Counting…</span>
                ) : (
                  (document.pageCount?.toLocaleString("en-GB") ?? "—")
                )}
              </TableCell>
              <TableCell flex={0.7}>
                <Tag tone={documentStateTone[document.state]}>{documentStateLabel[document.state]}</Tag>
              </TableCell>
              <TableCell flex={0.6} className="flex justify-end gap-1.5">
                <IconButton
                  icon="download"
                  aria-label={`Download ${document.title}`}
                  title="Download"
                  disabled={!isFileStored}
                  onClick={() => onDownload(document)}
                  className="disabled:opacity-40"
                />
                <IconButton
                  icon="x"
                  tone="danger"
                  aria-label={`Delete ${document.title}`}
                  title="Delete"
                  onClick={() => onDelete(document)}
                />
              </TableCell>
            </TableRow>
          );
        })}
    </Table>
  );
};
