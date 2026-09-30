"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDocumentDownloadUrlRequest } from "@/lib/api/documentsApi";
import { documentTypeIcon, knowledgeDocumentTypes } from "@/lib/types/adminDocument";
import type { KnowledgeResult } from "@/lib/types/knowledgeLibrary";

const typeLabel = (type: string) => knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type;

// "CAT 793F · p. 214 · Rev 4"
const formatMeta = (result: KnowledgeResult) =>
  [result.models[0], result.page ? `p. ${result.page}` : null, `Rev ${result.versionNumber}`].filter(Boolean).join(" · ");

// Opens the document (a short-lived signed link) in a new tab, at the
// matching page for PDFs. The tab opens before the link is fetched so
// browsers don't treat it as a popup.
export const KnowledgeResultCard = ({ result }: { result: KnowledgeResult }) => {
  const [openError, setOpenError] = useState<string | null>(null);
  const { icon, tone } = documentTypeIcon[result.type] ?? documentTypeIcon.manual;

  const openDocument = async () => {
    setOpenError(null);
    const tab = window.open("", "_blank");
    try {
      const signed = await getDocumentDownloadUrlRequest(requireAccessToken(), result.id);
      const url = result.page ? `${signed.url}#page=${result.page}` : signed.url;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      setOpenError(toApiErrorMessage(error, "Couldn't open this document. Please try again."));
    }
  };

  return (
    <button
      type="button"
      onClick={openDocument}
      className="flex flex-col gap-2 rounded-xl border border-borderGray bg-surface p-3.5 text-left transition-colors hover:border-borderGrayStrong"
    >
      <div className="flex w-full items-center gap-2">
        <Tag tone={tone}>
          <Icon name={icon} className="h-3.5 w-3.5" />
          {typeLabel(result.type)}
        </Tag>
        {result.source === "shared" && <Tag>QuipTech library</Tag>}
        <span className="ml-auto text-xs text-mutedGray">{formatMeta(result)}</span>
      </div>
      <span className="text-base font-medium text-ink">{result.title}</span>
      {result.heading && <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{result.heading}</span>}
      {result.snippet && <span className="text-[15px] text-bodyGray">{result.snippet}</span>}
      {openError && <span className="text-xs text-danger">{openError}</span>}
    </button>
  );
};
