"use client";

import { Icon } from "@/components/icons/icon";
import { IconTile } from "@/components/ui/iconTile";
import { Tag } from "@/components/ui/tag";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { DocumentUploader } from "@/components/uploads/documentUploader";
import {
  documentStateLabel,
  documentStateTone,
  documentTypeIcon,
  knowledgeDocumentTypes,
} from "@/lib/types/adminDocument";
import { useOrganisationDocuments } from "../useOrganisationDocuments";

const typeLabel = (type: string) => knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type;

// Real documents: the organisation's own uploads plus the shared QuipTech
// library, each opened through a short-lived signed link.
export const OrganisationDocuments = () => {
  const { documents, isLoading, loadError, reloadDocuments } = useOrganisationDocuments();

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-borderGray p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col">
          <h2 className="text-[15px] font-medium text-ink">Documents</h2>
          <span className="text-xs text-mutedGray">Your organisation&apos;s uploads and the shared QuipTech library</span>
        </div>
        <div className="ml-auto">
          <DocumentUploader onUploaded={reloadDocuments} />
        </div>
      </div>
      {isLoading && (
        <span className="flex items-center gap-2 text-sm text-mutedGray">
          <LoadingSpinner /> Loading documents…
        </span>
      )}
      {loadError && <span className="text-sm text-danger">{loadError}</span>}
      {!isLoading && !loadError && documents.length === 0 && (
        <span className="text-sm text-mutedGray">No documents yet.</span>
      )}
      {documents.map((document) => {
        const { icon, tone } = documentTypeIcon[document.type] ?? documentTypeIcon.manual;
        return (
          <div key={document.id} className="flex items-center gap-2.5 border-t border-slate-100 pt-2.5">
            <IconTile icon={icon} tone={tone} size="sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-ink">{document.title}</span>
              <span className="truncate text-xs text-mutedGray">
                {typeLabel(document.type)}
                {document.pageCount ? ` · ${document.pageCount} pages` : ""}
                {document.fileName ? ` · ${document.fileName}` : ""}
              </span>
            </div>
            <div className="ml-auto flex flex-none items-center gap-2">
              {document.isShared && <Tag>Shared</Tag>}
              <Tag tone={documentStateTone[document.state]}>{documentStateLabel[document.state]}</Tag>
              {document.downloadUrl && (
                <a
                  href={document.downloadUrl}
                  className="flex items-center gap-1 text-xs font-medium text-primary"
                  aria-label={`Download ${document.title}`}
                >
                  <Icon name="download" className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
};
