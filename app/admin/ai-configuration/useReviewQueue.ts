"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { listReviewersRequest, listReviewQueueRequest, updateReviewItemRequest } from "@/lib/api/aiConfigurationApi";
import type { ReviewStatus } from "@/lib/types/aiConfiguration";

const LOAD_FAILED_MESSAGE = "Couldn't load the review queue. Please try again.";

// Opens on unreviewed items, matching the "Unreviewed" filter the page
// starts with; "" in a filter means all.
export const useReviewQueue = () => {
  const [status, setStatus] = useState<ReviewStatus | "">("unreviewed");
  const [reviewerId, setReviewerId] = useState("");
  const queue = useApiResource(
    (accessToken) =>
      listReviewQueueRequest(accessToken, { status: status || undefined, reviewerId: reviewerId || undefined }),
    [status, reviewerId],
    LOAD_FAILED_MESSAGE,
  );
  const reviewers = useApiResource(listReviewersRequest, [], LOAD_FAILED_MESSAGE);

  // Rejects with the API's error so the calling dialog can show it. The
  // list is reloaded because the item may no longer match the filter.
  const updateItem = async (itemId: string, change: { status?: ReviewStatus; notes?: string }) => {
    const updated = await updateReviewItemRequest(requireAccessToken(), itemId, change);
    queue.reload();
    reviewers.reload();
    return updated;
  };

  return {
    status,
    setStatus,
    reviewerId,
    setReviewerId,
    page: queue.data,
    isLoading: queue.isLoading,
    loadError: queue.error,
    reviewers: reviewers.data ?? [],
    updateItem,
  };
};
