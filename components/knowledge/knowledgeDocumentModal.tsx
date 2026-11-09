"use client";

import { useEffect } from "react";
import { ArticleView } from "./article/articleView";
import type { ArticleNavigation } from "@/lib/knowledge/knowledgeLinks";

interface KnowledgeDocumentModalProps {
  documentId: string;
  title: string;
  navigation: ArticleNavigation;
  // The search's best-matching section: scrolled to and highlighted.
  initialSectionId: string | null;
  onClose: () => void;
  // Shows Delete to viewers allowed to; runs after it succeeds.
  onDeleted: () => void;
}

// A document read in place over the Knowledge results, with Download and
// Delete. Escape or the backdrop closes it.
export const KnowledgeDocumentModal = ({
  documentId,
  title,
  navigation,
  initialSectionId,
  onClose,
  onDeleted,
}: KnowledgeDocumentModalProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      // A confirm dialog open on top handles its own keys.
      if (event.key === "Escape" && !document.querySelectorAll('[role="dialog"]')[1]) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-inkStatic/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[90vh] w-[1100px] max-w-full flex-col overflow-hidden rounded-2xl bg-surface"
      >
        <ArticleView
          documentId={documentId}
          navigation={navigation}
          initialSectionId={initialSectionId}
          layout="modal"
          onClose={onClose}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
};
