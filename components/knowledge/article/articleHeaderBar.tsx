"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import type { ArticleNavigation } from "@/lib/knowledge/knowledgeLinks";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";

interface ArticleHeaderBarProps {
  title: string;
  article: KnowledgeArticle | null;
  navigation: ArticleNavigation;
  onDownload: () => void;
}

const linkButtonClasses =
  "inline-flex h-9 flex-none items-center gap-2 rounded-lg border border-borderGrayStrong bg-surface px-3.5 text-[15px] font-medium text-ink hover:bg-surfaceGray";

// "Knowledge › {title}" (back to the same results, or "Manuals" inside a
// machine page), then Open PDF,
// Download. Brand access is checked online.
export const ArticleHeaderBar = ({ title, article, navigation, onDownload }: ArticleHeaderBarProps) => (
  <div className="flex flex-none items-center gap-2.5 border-b border-slate-200/80 bg-surface px-6 py-4">
    <Link href={navigation.listHref} className="text-[15px] text-bodyGray hover:text-ink">
      {navigation.listLabel}
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
        <span className="text-xs text-mutedGray" title="Knowledge access is checked online.">
          Online access required
        </span>
      </div>
    )}
  </div>
);
