import { notFound } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { findKnowledgeArticle } from "@/lib/mockData/knowledge";
import { ArticleTocRail } from "./components/articleTocRail";

interface KnowledgeArticlePageProps {
  params: { slug: string };
}

const KnowledgeArticlePage = ({ params }: KnowledgeArticlePageProps) => {
  const article = findKnowledgeArticle(params.slug);
  if (!article) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <div className="flex flex-none items-center gap-2.5 border-b border-slate-200/80 bg-white px-6 py-4">
        <Link href="/knowledge" className="text-[15px] text-bodyGray">Knowledge</Link>
        <Icon name="chevr" className="stroke-mutedGray" />
        <span className="text-[15px] font-medium text-ink">{article.title}</span>
        <Button className="ml-auto">
          <Icon name="download" />
          Save offline
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3">
          <main className="flex flex-[2.4] flex-col gap-3 overflow-y-auto p-6">
            <h1 className="text-[22px] font-medium text-ink">{article.title}</h1>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Tag key={tag.label} tone={tag.tone}>{tag.label}</Tag>
              ))}
            </div>
            <span className="text-[15px] text-bodyGray">{article.intro}</span>
            <div className="flex h-[150px] flex-col items-center justify-center gap-1.5 rounded-lg border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
              <Icon name="image" className="h-6 w-6" />
              {article.imageCaption}
            </div>
            <h2 className="text-base font-medium text-ink">Prerequisites</h2>
            {article.prerequisites.map((paragraph) => (
              <span key={paragraph} className="text-[15px] text-bodyGray">{paragraph}</span>
            ))}
          </main>
          <ArticleTocRail />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeArticlePage;
