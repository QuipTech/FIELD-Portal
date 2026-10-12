"use client";

import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getPromptDiffRequest } from "@/lib/api/aiConfigurationApi";

const lineClasses = {
  same: "text-bodyGray",
  added: "bg-primaryTint text-ink",
  removed: "bg-dangerTint text-danger line-through",
};
const linePrefix = { same: " ", added: "+", removed: "−" };

// Compares a version with the one saved just before it.
export const PromptDiffModal = ({ versionId, onClose }: { versionId: string; onClose: () => void }) => {
  const diff = useApiResource(
    (accessToken) => getPromptDiffRequest(accessToken, versionId),
    [versionId],
    "Couldn't load the diff. Please try again.",
  );
  const title = diff.data ? `Diff v${diff.data.from.versionNumber} → v${diff.data.to.versionNumber}` : "Diff";

  return (
    <Modal title={title} onClose={onClose} widthClassName="w-[760px]">
      <div className="flex flex-col gap-2 p-5">
        {diff.isLoading && (
          <span className="flex items-center gap-2 text-sm text-mutedGray">
            <LoadingSpinner /> Loading diff…
          </span>
        )}
        {diff.error && <span className="text-sm text-danger">{diff.error}</span>}
        {diff.data && (
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-borderGray font-mono text-[13px]">
            {diff.data.lines.map((line, index) => (
              <div key={index} className={`whitespace-pre-wrap px-3 py-0.5 ${lineClasses[line.type]}`}>
                {linePrefix[line.type]} {line.text}
              </div>
            ))}
          </pre>
        )}
      </div>
    </Modal>
  );
};
