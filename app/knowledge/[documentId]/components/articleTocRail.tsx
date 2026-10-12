import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { buildArticleHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";
import { UNTITLED_SECTION_HEADING } from "./articleSectionBlock";

interface ArticleTocRailProps {
  article: KnowledgeArticle;
  activeSectionId: string | null;
  listContext: KnowledgeListContext;
  onJump: (sectionId: string) => void;
}

const railHeadingClasses = "px-2.5 pb-2 text-xs font-medium uppercase tracking-wide text-white/50";

// "On this page" (one link per section, the one in view highlighted),
// related documents, and Ask AI about this document.
export const ArticleTocRail = ({ article, activeSectionId, listContext, onJump }: ArticleTocRailProps) => {
  const askHref = `/assistant?${new URLSearchParams({ document: article.id, documentTitle: article.title }).toString()}`;
  return (
    <aside className="flex w-[232px] flex-none flex-col gap-0.5 overflow-y-auto rounded-2xl bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      <span className={`pt-1 ${railHeadingClasses}`}>On this page</span>
      <nav aria-label="On this page" className="flex flex-col gap-0.5">
        {article.sections.map((section) => {
          const isActive = section.id === activeSectionId;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onJump(section.id);
              }}
              className={`rounded-lg px-2.5 py-2 text-[14px] leading-snug ${
                isActive ? "bg-white/[0.16] font-medium text-white" : "text-white/75 hover:bg-white/10"
              }`}
            >
              {section.heading ?? UNTITLED_SECTION_HEADING}
            </a>
          );
        })}
      </nav>
      {article.related.length > 0 && (
        <>
          <span className={`mt-2 border-t border-white/[0.16] pt-3.5 ${railHeadingClasses}`}>Related</span>
          <div className="flex flex-col gap-2 px-2.5">
            {article.related.map((link) => (
              <Link key={link.id} href={buildArticleHref(link.id, listContext)} className="text-[13px] text-white/75 underline">
                {link.title}
                {link.page ? ` · p. ${link.page}` : ""}
              </Link>
            ))}
          </div>
        </>
      )}
      <Link
        href={askHref}
        className="mx-2.5 mt-auto flex h-9 flex-none items-center justify-center gap-2 rounded-lg bg-white/[0.16] text-[15px] font-medium text-white hover:bg-white/25"
      >
        <Icon name="spark" />
        Ask AI
      </Link>
    </aside>
  );
};
