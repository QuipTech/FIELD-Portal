"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import { useOrganisationDocuments } from "../useOrganisationDocuments";
import { OrganisationDocumentRow } from "./organisationDocumentRow";

// The organisation's own documents plus the shared QuipTech library; each
// row opens the document's article. Documents are added from the admin
// portal (Admin → Knowledge), not here.
export const OrganisationDocuments = ({ listContext }: { listContext: KnowledgeListContext }) => {
  const { documents, isLoading, loadError } = useOrganisationDocuments();

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-borderGray p-4">
      <div className="flex flex-col">
        <h2 className="text-[15px] font-medium text-ink">Documents</h2>
        <span className="text-xs text-mutedGray">Your organisation&apos;s documents and the shared QuipTech library</span>
      </div>
      {isLoading && (
        <span className="flex items-center gap-2 text-sm text-mutedGray">
          <LoadingSpinner /> Loading documents…
        </span>
      )}
      {loadError && <span className="text-sm text-danger">{loadError}</span>}
      {!isLoading && !loadError && documents.length === 0 && (
        <span className="text-sm text-mutedGray">No documents yet.</span>
      )}
      {documents.map((document) => (
        <OrganisationDocumentRow key={document.id} document={document} listContext={listContext} />
      ))}
    </section>
  );
};
