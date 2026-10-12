"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { buildKnowledgeListHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";

interface OfflineCopyControls {
  isSaved: boolean;
  isJustSaved: boolean;
  hasPdf: boolean;
  isBusy: boolean;
  save: () => void;
  remove: () => void;
}

interface ArticleHeaderBarProps {
  title: string;
  article: KnowledgeArticle | null;
  listContext: KnowledgeListContext;
  offline: OfflineCopyControls;
  onDownload: () => void;
}

const PDF_NOT_SAVED_NOTE = "The article is saved; its PDF couldn't be saved for offline use.";

const linkButtonClasses =
  "inline-flex h-9 flex-none items-center gap-2 rounded-lg border border-borderGrayStrong bg-surface px-3.5 text-[15px] font-medium text-ink hover:bg-surfaceGray";

// "Knowledge › {title}" (back to the same results), then Open PDF,
// Download and Save offline.
export const ArticleHeaderBar = ({ title, article, listContext, offline, onDownload }: ArticleHeaderBarProps) => (
  <div className="flex flex-none items-center gap-2.5 border-b border-slate-200/80 bg-surface px-6 py-4">
    <Link href={buildKnowledgeListHref(listContext)} className="text-[15px] text-bodyGray hover:text-ink">
      Knowledge
    </Link>
    <Icon name="chevr" className="flex-none stroke-mutedGray" />
    <span className="truncate text-[15px] font-medium text-ink">{title}</span>
    {article && (
      <div className="ml-auto flex flex-none items-center gap-2">
        {article.pdfUrl && (
          <a href={article.pdfUrl} target="_blank" rel="noreferrer" className={linkButtonClasses}>
            <Icon name="ext" />
            Open PDF
          </a>
        )}
        <Button onClick={onDownload}>
          <Icon name="download" />
          Download
        </Button>
        {offline.isJustSaved && (
          <Button disabled title={offline.hasPdf ? undefined : PDF_NOT_SAVED_NOTE}>
            <Icon name="check" />
            Saved offline ✓
          </Button>
        )}
        {offline.isSaved && !offline.isJustSaved && (
          <Button onClick={offline.remove} disabled={offline.isBusy} title={offline.hasPdf ? undefined : PDF_NOT_SAVED_NOTE}>
            <Icon name="x" />
            Remove offline copy
          </Button>
        )}
        {!offline.isSaved && (
          <Button onClick={offline.save} disabled={offline.isBusy}>
            <Icon name="cloud" />
            {offline.isBusy ? "Saving…" : "Save offline"}
          </Button>
        )}
      </div>
    )}
  </div>
);
