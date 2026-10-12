"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { retryDocumentRequest } from "@/lib/api/documentLifecycleApi";
import type { DocumentStatus } from "@/lib/types/adminDocument";

interface ArticleStateNoticeProps {
  documentId: string;
  kind: "notFound" | "notLive" | "error";
  status?: DocumentStatus | null;
  message?: string;
  backHref: string;
  onRetried: () => void;
}

const NOT_LIVE_TEXT: Partial<Record<DocumentStatus["state"], string>> = {
  needs_review: "This document is waiting for QuipTech to review it before it goes live.",
  archived: "This document has been archived.",
  uploading: "This document is still uploading.",
};

// Not found, still indexing, failed (Retry for those who manage
// documents; the API decides who may), or couldn't load.
export const ArticleStateNotice = ({ documentId, kind, status, message, backHref, onRetried }: ArticleStateNoticeProps) => {
  const { can } = usePermissions();
  const [retryError, setRetryError] = useState<string | null>(null);
  const backLink = (
    <Link href={backHref} className="text-sm text-primary hover:underline">
      Back to Knowledge
    </Link>
  );

  if (kind === "notFound") return <EmptyState icon="file" title="Document not found" actions={backLink} className="flex-1" />;
  if (kind === "error") return <EmptyState icon="alert" title={message ?? "Couldn't load this document."} actions={backLink} className="flex-1" />;

  if (status?.state === "failed") {
    const canRetry = can(PERMISSIONS.submitDocuments) || can(PERMISSIONS.managePlatform);
    const retry = () =>
      retryDocumentRequest(requireAccessToken(), documentId)
        .then(onRetried)
        .catch((error: unknown) => setRetryError(toApiErrorMessage(error, "Couldn't retry indexing.")));
    return (
      <EmptyState
        icon="alert"
        title="This document couldn't be indexed"
        description={retryError ?? status.errorMessage ?? undefined}
        actions={
          <>
            {canRetry && <Button onClick={retry}>Retry</Button>}
            {backLink}
          </>
        }
        className="flex-1"
      />
    );
  }

  const isIndexing = !status || ["queued", "indexing"].includes(status.state);
  return (
    <EmptyState
      icon="clock"
      title={
        isIndexing
          ? `This document is still being indexed (${status?.progress ?? 0}%)`
          : (NOT_LIVE_TEXT[status.state] ?? "This document isn't live yet.")
      }
      description={isIndexing ? "It opens here as soon as it's ready." : undefined}
      actions={backLink}
      className="flex-1"
    />
  );
};
