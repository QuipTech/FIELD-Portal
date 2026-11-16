"use client";

import { notFound, useRouter } from "next/navigation";
import { knowledgeArticleNavigation, readListContext } from "@/lib/knowledge/knowledgeLinks";
import { ArticleView } from "@/components/knowledge/article/articleView";

interface KnowledgeArticlePageProps {
  params: { documentId: string };
  // q/type/make/model: the Knowledge results it was opened from;
  // section: the search's best-matching section.
  searchParams: Record<string, string | undefined>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /knowledge/:documentId — a document as a readable article. A client
// page: its navigation holds functions, which can't be passed from a
// server component to the client ArticleView.
const KnowledgeArticlePage = ({ params, searchParams }: KnowledgeArticlePageProps) => {
  const router = useRouter();
  if (!UUID.test(params.documentId)) notFound();
  const query = new URLSearchParams(
    Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const navigation = knowledgeArticleNavigation(readListContext(query));
  return (
    <ArticleView
      documentId={params.documentId}
      navigation={navigation}
      initialSectionId={query.get("section")}
      onDeleted={() => router.push(navigation.listHref)}
    />
  );
};

export default KnowledgeArticlePage;
