import type { ArticleSection } from "@/lib/types/knowledgeArticle";
import { ArticleContent } from "./articleContent";
import { ArticleFigure } from "./articleFigure";

// Shown for a section with no heading of its own (an untitled opening).
export const UNTITLED_SECTION_HEADING = "Overview";

interface ArticleSectionBlockProps {
  section: ArticleSection;
  // The section a search result opened: briefly highlighted.
  isHighlighted: boolean;
}

export const ArticleSectionBlock = ({ section, isHighlighted }: ArticleSectionBlockProps) => (
  <section
    id={section.id}
    className={`-mx-3 flex scroll-mt-4 flex-col gap-3 rounded-xl px-3 py-2 transition-colors duration-1000 ${
      isHighlighted ? "bg-amberTint" : "bg-transparent"
    }`}
  >
    <div className="flex items-baseline gap-3">
      <h2 className="text-lg font-medium text-ink">{section.heading ?? UNTITLED_SECTION_HEADING}</h2>
      {section.page && <span className="text-xs text-mutedGray">p. {section.page}</span>}
    </div>
    <ArticleContent content={section.content} />
    {section.figures.map((figure) => (
      <ArticleFigure key={`${figure.page}-${figure.caption}`} figure={figure} />
    ))}
  </section>
);
