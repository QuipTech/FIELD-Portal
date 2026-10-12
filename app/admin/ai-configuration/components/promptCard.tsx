"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { usePromptVersions } from "../usePromptVersions";
import { describePromptVersion } from "../promptVersionLabel";
import { PromptEditorModal } from "./promptEditorModal";
import { PromptTestModal } from "./promptTestModal";
import { PromptDiffModal } from "./promptDiffModal";
import { PromptHistoryModal } from "./promptHistoryModal";

type PromptDialog = "edit" | "test" | "diff" | "history";

export const PromptCard = () => {
  const prompt = usePromptVersions();
  const [dialog, setDialog] = useState<PromptDialog | null>(null);
  const { versions, selectedSummary, selectedVersion } = prompt;
  const previousVersion = versions.find(
    (version) => selectedSummary && version.versionNumber < selectedSummary.versionNumber,
  );
  const closeDialog = () => setDialog(null);

  return (
    <Card className="gap-3">
      <div className="flex items-center">
        <h2 className="text-base font-medium text-ink">Prompt</h2>
        {selectedSummary && (
          <Tag tone={selectedSummary.isLive ? "primary" : "default"} className="ml-auto">
            v{selectedSummary.versionNumber} · {selectedSummary.isLive ? "live" : "not live"}
          </Tag>
        )}
      </div>
      {prompt.isLoading && (
        <span className="flex items-center gap-2 text-sm text-mutedGray">
          <LoadingSpinner /> Loading prompt…
        </span>
      )}
      {prompt.loadError && <span className="text-sm text-danger">{prompt.loadError}</span>}
      {!prompt.isLoading && !prompt.loadError && versions.length === 0 && (
        <span className="text-sm text-mutedGray">No prompt yet. Write the first version with Save prompt.</span>
      )}
      {selectedSummary && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Prompt version</span>
          <select
            value={selectedSummary.id}
            onChange={(event) => prompt.selectVersion(event.target.value)}
            className="h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink"
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {describePromptVersion(version)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2.5">
        <Button onClick={() => setDialog("diff")} disabled={!previousVersion}>
          <Icon name="diff" />
          {previousVersion ? `View diff vs v${previousVersion.versionNumber}` : "View diff"}
        </Button>
        <Button onClick={() => setDialog("history")} disabled={versions.length === 0}>
          <Icon name="history" />
          Version history
        </Button>
      </div>
      <div className="mt-auto flex gap-2.5">
        <Button onClick={() => setDialog("test")} disabled={!selectedVersion}>
          <Icon name="eye" />
          Test
        </Button>
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => setDialog("edit")}
          disabled={prompt.isLoading || Boolean(prompt.loadError) || (versions.length > 0 && !selectedVersion)}
        >
          <Icon name="check" />
          Save prompt
        </Button>
      </div>
      {dialog === "edit" && (
        <PromptEditorModal
          initialBody={selectedVersion?.body ?? ""}
          onSave={prompt.saveVersion}
          onClose={closeDialog}
        />
      )}
      {dialog === "test" && selectedVersion && (
        <PromptTestModal
          versionLabel={`v${selectedVersion.versionNumber}`}
          body={selectedVersion.body}
          onTest={prompt.testPrompt}
          onClose={closeDialog}
        />
      )}
      {dialog === "diff" && selectedSummary && <PromptDiffModal versionId={selectedSummary.id} onClose={closeDialog} />}
      {dialog === "history" && (
        <PromptHistoryModal
          versions={versions}
          onView={prompt.selectVersion}
          onPublish={prompt.publishVersion}
          onClose={closeDialog}
        />
      )}
    </Card>
  );
};
