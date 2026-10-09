"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { ClickableRow } from "@/components/ui/clickableRow";
import { buildArticleHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import { documentTypeIcon, knowledgeDocumentTypes } from "@/lib/types/adminDocument";
import type { KnowledgeResult } from "@/lib/types/knowledgeLibrary";

const typeLabel = (type: string) => knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type;

// "CAT 793F · p. 2 · Rev 4" — the page of the passage that matched (none
// when browsing).
const formatMeta = (result: KnowledgeResult) =>
  [result.models[0], result.page ? `p. ${result.page}` : null, `Rev ${result.versionNumber}`].filter(Boolean).join(" · ");

interface KnowledgeResultCardProps {
  result: KnowledgeResult;
  listContext: KnowledgeListContext;
}

// Opens the document's article, at the section that matched the search.
export const KnowledgeResultCard = ({ result, listContext }: KnowledgeResultCardProps) => {
  const router = useRouter();
  const { icon, tone } = documentTypeIcon[result.type] ?? documentTypeIcon.manual;

  return (
    <ClickableRow
      label={`Open ${result.title}`}
      onOpen={() => router.push(buildArticleHref(result.id, listContext, result.sectionId))}
      className="flex flex-col gap-2 rounded-xl border border-borderGray bg-surface p-3.5 text-left transition-colors hover:border-borderGrayStrong"
    >
      <div className="flex w-full items-center gap-2">
        <span data-row-ignore className="flex items-center gap-2">
          <Tag tone={tone}>
            <Icon name={icon} className="h-3.5 w-3.5" />
            {typeLabel(result.type)}
          </Tag>
          {result.source === "shared" && <Tag>QuipTech library</Tag>}
        </span>
        <span className="ml-auto text-xs text-mutedGray">{formatMeta(result)}</span>
      </div>
      <span className="text-base font-medium text-ink">{result.title}</span>
      {result.heading && <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{result.heading}</span>}
      {result.snippet && <span className="text-[15px] text-bodyGray">{result.snippet}</span>}
    </ClickableRow>
  );
};
