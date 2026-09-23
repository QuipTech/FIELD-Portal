import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { KnowledgeSearchResult } from "@/lib/types/knowledgeArticle";

export const KnowledgeResultCard = ({ result }: { result: KnowledgeSearchResult }) => {
  return (
    <Link
      href={`/knowledge/${result.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-borderGray bg-white p-3.5"
    >
      <div className="flex items-center">
        <Tag tone={result.docTone}>
          <Icon name={result.docIcon} className="h-3.5 w-3.5" />
          {result.docLabel}
        </Tag>
        <span className="ml-auto text-xs text-mutedGray">{result.metaLabel}</span>
      </div>
      <span className="text-base font-medium text-ink">{result.title}</span>
      <span className="text-[15px] text-bodyGray">{result.summary}</span>
    </Link>
  );
};
