"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { PromptVersionSummary } from "@/lib/types/aiConfiguration";
import { describePromptVersion } from "../promptVersionLabel";

interface PromptHistoryModalProps {
  versions: PromptVersionSummary[];
  onView: (versionId: string) => void;
  onPublish: (versionId: string) => Promise<void>;
  onClose: () => void;
}

// Every saved version; publishing an older one rolls the prompt back.
export const PromptHistoryModal = ({ versions, onView, onPublish, onClose }: PromptHistoryModalProps) => {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = async (versionId: string) => {
    setPublishingId(versionId);
    setPublishError(null);
    try {
      await onPublish(versionId);
    } catch (error) {
      setPublishError(toApiErrorMessage(error, "Couldn't publish this version. Please try again."));
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <Modal title="Version history" onClose={onClose} widthClassName="w-[560px]">
      <div className="flex flex-col gap-2 p-5">
        {publishError && <span className="text-xs text-danger">{publishError}</span>}
        {versions.map((version) => (
          <div key={version.id} className="flex items-center gap-2.5 border-b border-borderGray py-2 last:border-b-0">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm text-ink">{describePromptVersion(version)}</span>
              {version.notes && <span className="truncate text-xs text-mutedGray">{version.notes}</span>}
            </div>
            <div className="ml-auto flex flex-none items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onView(version.id);
                  onClose();
                }}
              >
                View
              </Button>
              {version.isLive ? (
                <Tag tone="primary">Live</Tag>
              ) : (
                <Button size="sm" onClick={() => publish(version.id)} disabled={publishingId !== null}>
                  {publishingId === version.id ? "Publishing…" : "Publish"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
