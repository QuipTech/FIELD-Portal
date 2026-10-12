import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/iconTile";
import { ActionMenu } from "@/components/ui/actionMenu";
import { OwnershipTag } from "@/components/admin/ownershipTag";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
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
import { availableRowActions, type DocumentRowAction } from "../documentRowActions";

interface DocumentsTableProps {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  loadError: string | null;
  onAction: (document: KnowledgeDocument, action: DocumentRowAction) => void;
}

const FAILED_ICON = { icon: "x", tone: "danger" } as const;

const typeLabel = (type: string) =>
  knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type.replace(/_/g, " ");

const TableMessage = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-center gap-2 p-10 text-sm text-mutedGray">{children}</div>
);

// Under the title: why it failed, why it was rejected, or the file name.
const DocumentSubtitle = ({ document }: { document: KnowledgeDocument }) => {
  if (document.state === "failed" && document.errorMessage) {
    return (
      <span title={document.errorMessage} className="truncate text-xs text-danger">
        {document.errorMessage}
      </span>
    );
  }
  if (document.state === "archived" && document.reviewNote) {
    return <span className="truncate text-xs text-mutedGray">Rejected: {document.reviewNote}</span>;
  }
  const version = document.versionNumber > 1 ? ` · v${document.versionNumber}` : "";
  return document.fileName ? (
    <span className="truncate text-xs text-mutedGray">
      {document.fileName}
      {version}
    </span>
  ) : null;
};

export const DocumentsTable = ({ documents, isLoading, loadError, onAction }: DocumentsTableProps) => {
  const { can } = usePermissions();
  const canReview = can(PERMISSIONS.managePlatform);
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3.2}>Document</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Type</TableHeaderCell>
        <TableHeaderCell flex={1}>Indexed</TableHeaderCell>
        <TableHeaderCell flex={0.5}>Pages</TableHeaderCell>
        <TableHeaderCell flex={0.8}>State</TableHeaderCell>
        <TableHeaderCell flex={0.3}>{""}</TableHeaderCell>
      </TableHeaderRow>
      {loadError && <TableMessage><span className="text-danger">{loadError}</span></TableMessage>}
      {!loadError && isLoading && <TableMessage><LoadingSpinner /> Loading documents…</TableMessage>}
      {!loadError && !isLoading && documents.length === 0 && (
        <TableMessage>No documents yet. Upload a manual, bulletin or procedure to start the library.</TableMessage>
      )}
      {!loadError &&
        documents.map((document) => {
          const { icon, tone } =
            document.state === "failed" ? FAILED_ICON : (documentTypeIcon[document.type] ?? documentTypeIcon.manual);
          return (
            <TableRow key={document.id}>
              <TableCell flex={3.2} className="flex items-center gap-2.5">
                <IconTile icon={icon} tone={tone} size="sm" />
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{document.title}</span>
                    <OwnershipTag organisationName={document.organisationName} />
                  </span>
                  <DocumentSubtitle document={document} />
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
              <TableCell flex={0.8}>
                <Tag tone={documentStateTone[document.state]}>{documentStateLabel[document.state]}</Tag>
              </TableCell>
              <TableCell flex={0.3} className="flex justify-end">
                <ActionMenu
                  label={document.title}
                  items={availableRowActions(document, canReview).map((item) => ({
                    label: item.label,
                    icon: item.icon,
                    tone: item.tone,
                    onSelect: () => onAction(document, item.action),
                  }))}
                />
              </TableCell>
            </TableRow>
          );
        })}
    </Table>
  );
};
