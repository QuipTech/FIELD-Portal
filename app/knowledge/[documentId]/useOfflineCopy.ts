"use client";

import { useEffect, useState } from "react";
import { findOfflineArticle, removeOfflineArticle, saveOfflineArticle } from "@/lib/knowledge/offlineArticleStore";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";

// The PDF is fetched with the article's signed link. If the bucket won't
// allow the cross-origin read, only the article text is saved.
const fetchPdf = async (url: string | null): Promise<Blob | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
};

// "Save offline": whether this article is saved on this device, and
// saving or removing it.
export const useOfflineCopy = (article: KnowledgeArticle | null) => {
  const [isSaved, setIsSaved] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // Saved during this visit: the button reads "Saved offline ✓".
  const [isJustSaved, setIsJustSaved] = useState(false);
  const articleId = article?.id;

  useEffect(() => {
    if (!articleId) return;
    findOfflineArticle(articleId)
      .then((saved) => {
        setIsSaved(saved !== null);
        setHasPdf(Boolean(saved?.pdf));
      })
      .catch(() => setIsSaved(false));
  }, [articleId]);

  const save = async () => {
    if (!article) return;
    setIsBusy(true);
    try {
      const pdf = await fetchPdf(article.pdfUrl);
      await saveOfflineArticle({ id: article.id, savedAt: new Date().toISOString(), article, pdf });
      setIsSaved(true);
      setIsJustSaved(true);
      setHasPdf(pdf !== null);
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (!article) return;
    setIsBusy(true);
    try {
      await removeOfflineArticle(article.id);
      setIsSaved(false);
      setIsJustSaved(false);
      setHasPdf(false);
    } finally {
      setIsBusy(false);
    }
  };

  return { isSaved, isJustSaved, hasPdf, isBusy, save, remove };
};
