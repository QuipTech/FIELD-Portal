"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorToast } from "@/components/ui/errorToast";
import { Tag } from "@/components/ui/tag";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDocumentDownloadUrlRequest } from "@/lib/api/documentsApi";
import { buildKnowledgeListHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import { useKnowledgeArticle } from "../useKnowledgeArticle";
import { useOfflineCopy } from "../useOfflineCopy";
import { useActiveSection } from "../useActiveSection";
import { ArticleHeaderBar } from "./articleHeaderBar";
import { ArticleSkeleton } from "./articleSkeleton";
import { ArticleStateNotice } from "./articleStateNotice";
import { ArticleTags } from "./articleTags";
import { ArticleSectionBlock } from "./articleSectionBlock";
import { ArticleTocRail } from "./articleTocRail";
import { PdfFallbackViewer } from "./pdfFallbackViewer";

const HIGHLIGHT_MS = 2_500;

interface ArticleViewProps {
  documentId: string;
  listContext: KnowledgeListContext;
  // Opened from a search result: scroll to and highlight this section.
  initialSectionId: string | null;
}

export const ArticleView = ({ documentId, listContext, initialSectionId }: ArticleViewProps) => {
  const { state, reload } = useKnowledgeArticle(documentId);
  const article = state.kind === "ready" ? state.article : null;
  const offline = useOfflineCopy(article);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hasJumped = useRef(false);
  const sections = article?.sections ?? [];
  const activeSectionId = useActiveSection(sections.map((section) => section.id), scrollRoot);

  const jumpTo = (sectionId: string, behavior: ScrollBehavior = "smooth") => {
    scrollRoot?.querySelector(`#${CSS.escape(sectionId)}`)?.scrollIntoView({ behavior, block: "start" });
  };

  useEffect(() => {
    if (!article || !scrollRoot || !initialSectionId || hasJumped.current) return;
    hasJumped.current = true;
    if (!article.sections.some((section) => section.id === initialSectionId)) return;
    jumpTo(initialSectionId, "auto");
    setHighlightedId(initialSectionId);
    const timer = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
    // jumpTo only reads scrollRoot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, scrollRoot, initialSectionId]);

  const download = async () => {
    try {
      window.location.href = (await getDocumentDownloadUrlRequest(requireAccessToken(), documentId)).url;
    } catch (error) {
      setToast(toApiErrorMessage(error, "Couldn't download this document."));
    }
  };

  const saveOffline = () =>
    offline.save().catch((error: unknown) => setToast(toApiErrorMessage(error, "Couldn't save it for offline use.")));

  const renderBody = () => {
    if (state.kind === "loading") return <ArticleSkeleton />;
    if (state.kind !== "ready") {
      return (
        <ArticleStateNotice
          documentId={documentId}
          kind={state.kind}
          status={state.kind === "notLive" ? state.status : undefined}
          message={state.kind === "error" ? state.message : undefined}
          backHref={buildKnowledgeListHref(listContext)}
          onRetried={reload}
        />
      );
    }
    const { article: loaded } = state;
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-[22px] font-medium text-ink">{loaded.title}</h1>
        <ArticleTags article={loaded} listContext={listContext} />
        {state.isOfflineCopy && <Tag className="w-fit">Offline copy</Tag>}
        {loaded.summary && <p className="text-[15px] leading-relaxed text-bodyGray">{loaded.summary}</p>}
        {loaded.sections.length === 0 ? (
          <PdfFallbackViewer pdfUrl={loaded.pdfUrl} title={loaded.title} />
        ) : (
          loaded.sections.map((section) => (
            <ArticleSectionBlock key={section.id} section={section} isHighlighted={section.id === highlightedId} />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <ArticleHeaderBar
        title={article?.title ?? "Document"}
        article={article}
        listContext={listContext}
        offline={{ ...offline, save: saveOffline, remove: () => void offline.remove() }}
        onDownload={download}
      />
      <div className="flex min-h-0 flex-1">
        <div className="m-4 flex flex-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-surface p-3">
          <main ref={setScrollRoot} className="flex min-w-0 flex-[2.4] flex-col overflow-y-auto">
            {renderBody()}
          </main>
          {article && article.sections.length > 0 && (
            <ArticleTocRail article={article} activeSectionId={activeSectionId} listContext={listContext} onJump={jumpTo} />
          )}
        </div>
      </div>
      {toast && <ErrorToast key={toast} message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
