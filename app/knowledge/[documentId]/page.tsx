import { notFound } from "next/navigation";
import { readListContext } from "@/lib/knowledge/knowledgeLinks";
import { ArticleView } from "./components/articleView";

interface KnowledgeArticlePageProps {
  params: { documentId: string };
  // q/type/make/model: the Knowledge results it was opened from;
  // section: the search's best-matching section.
  searchParams: Record<string, string | undefined>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /knowledge/:documentId — a document as a readable article.
const KnowledgeArticlePage = ({ params, searchParams }: KnowledgeArticlePageProps) => {
  if (!UUID.test(params.documentId)) notFound();
  const query = new URLSearchParams(
    Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return (
    <ArticleView
      documentId={params.documentId}
      listContext={readListContext(query)}
      initialSectionId={query.get("section")}
    />
  );
};

export default KnowledgeArticlePage;
