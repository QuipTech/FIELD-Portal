"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { IconTile } from "@/components/ui/iconTile";
import { Tag } from "@/components/ui/tag";
import { ClickableRow } from "@/components/ui/clickableRow";
import { buildArticleHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import type { OrganisationDocument } from "@/lib/api/documentsApi";
import { documentStateLabel, documentStateTone, documentTypeIcon, knowledgeDocumentTypes } from "@/lib/types/adminDocument";

const typeLabel = (type: string) => knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type;

interface OrganisationDocumentRowProps {
  document: OrganisationDocument;
  listContext: KnowledgeListContext;
}

// One document in the Documents card: opens its article. Download and the
// Shared/state tags keep their own behaviour.
export const OrganisationDocumentRow = ({ document, listContext }: OrganisationDocumentRowProps) => {
  const router = useRouter();
  const { icon, tone } = documentTypeIcon[document.type] ?? documentTypeIcon.manual;

  return (
    <ClickableRow
      label={`Open ${document.title}`}
      onOpen={() => router.push(buildArticleHref(document.id, listContext))}
      className="flex items-center gap-2.5 rounded-lg border-t border-slate-100 px-1 pt-2.5 hover:bg-surfaceGray"
    >
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
        <span data-row-ignore className="flex items-center gap-2">
          {document.isShared && <Tag>Shared</Tag>}
          <Tag tone={documentStateTone[document.state]}>{documentStateLabel[document.state]}</Tag>
        </span>
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
    </ClickableRow>
  );
};
