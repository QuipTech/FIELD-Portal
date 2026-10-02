"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { liveHistoryEntryTypes } from "@/lib/types/historyEntry";
import type { LiveHistoryEntryType } from "@/lib/types/machineHistory";

interface LiveAddEntryModalProps {
  machineLabel: string;
  onCreate: (entry: { entryType: LiveHistoryEntryType; description: string }) => Promise<void>;
  onClose: () => void;
  // Prefills "What happened", e.g. from an AI assistant answer.
  initialDescription?: string;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the entry. Please try again.";
const entryTypeOptions = Object.entries(liveHistoryEntryTypes) as [LiveHistoryEntryType, { label: string }][];

// Photos are added on the saved entry in the timeline ("Add photo"), since
// they're stored against the entry.
export const LiveAddEntryModal = ({ machineLabel, onCreate, onClose, initialDescription = "" }: LiveAddEntryModalProps) => {
  const [entryType, setEntryType] = useState<LiveHistoryEntryType>("repair");
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onCreate({ entryType, description: description.trim() });
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`New history entry — ${machineLabel}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Entry type</span>
          <div className="flex flex-wrap gap-2">
            {entryTypeOptions.map(([value, { label }]) => (
              <Button key={value} type="button" size="sm" variant={entryType === value ? "primary" : "default"} onClick={() => setEntryType(value)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">What happened</span>
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            required
            placeholder="Describe the fault, what you did and how you verified it…"
            className="resize-none rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
          />
        </div>
        <span className="text-xs text-mutedGray">Add photos to the entry from the timeline once it&apos;s saved.</span>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={isSaving || !description.trim()}>
            <Icon name="check" />
            {isSaving ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
