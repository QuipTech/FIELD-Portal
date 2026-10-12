"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/searchSelect";
import type { NewHistoryEntry } from "@/lib/types/historyEntry";
import { EntryFormField } from "./entryFormField";
import { EntryTypeSegmentedControl } from "./entryTypeSegmentedControl";
import { HistoryMediaPicker } from "./historyMediaPicker";
import {
  DESCRIPTION_MAX_LENGTH,
  toNewHistoryEntry,
  validateHistoryEntryDraft,
  type HistoryEntryDraft,
} from "./historyEntryDraft";

interface HistoryEntryModalProps {
  machineLabel: string;
  // This machine's components, as "System › Component" options.
  componentOptions: SearchSelectOption[];
  defaultHours: number | null;
  // Prefills "What happened", e.g. from an AI assistant answer.
  initialDescription?: string;
  // Rejects when the entry wasn't saved; the modal shows toErrorMessage.
  onSubmit: (entry: NewHistoryEntry) => Promise<void>;
  toErrorMessage: (error: unknown) => string;
  onClose: () => void;
}

export const HistoryEntryModal = (props: HistoryEntryModalProps) => {
  const { machineLabel, componentOptions, defaultHours, initialDescription = "", onSubmit, toErrorMessage, onClose } = props;
  const [draft, setDraft] = useState<HistoryEntryDraft>({
    type: null,
    componentId: "",
    componentReplaced: false,
    description: initialDescription,
    photos: [],
    hours: defaultHours === null ? "" : String(defaultHours),
    downtime: "",
  });
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errors = hasTriedSubmit ? validateHistoryEntryDraft(draft) : {};
  const update = (changes: Partial<HistoryEntryDraft>) => setDraft((current) => ({ ...current, ...changes }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasTriedSubmit(true);
    if (Object.keys(validateHistoryEntryDraft(draft)).length > 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSubmit(toNewHistoryEntry(draft, componentOptions));
    } catch (error) {
      setSaveError(toErrorMessage(error));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`New history entry — ${machineLabel}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <EntryFormField label="Entry type" error={errors.type} isRequired>
          <EntryTypeSegmentedControl value={draft.type} onChange={(type) => update({ type })} hasError={Boolean(errors.type)} />
        </EntryFormField>
        <EntryFormField label="Component affected">
          <SearchSelect
            options={componentOptions}
            value={draft.componentId}
            onChange={(componentId) => update({ componentId })}
            placeholder="Hydraulics › Main pump"
          />
          {draft.type === "repair" && draft.componentId && (
            <label className="flex items-center gap-2 text-[13px] text-bodyGray">
              <input
                type="checkbox"
                checked={draft.componentReplaced}
                onChange={(event) => update({ componentReplaced: event.target.checked })}
                className="accent-primary"
              />
              Component was replaced (takes a configuration snapshot)
            </label>
          )}
        </EntryFormField>
        <EntryFormField label="What happened" htmlFor="history-entry-description" error={errors.description} isRequired>
          <textarea
            id="history-entry-description"
            rows={4}
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
            maxLength={DESCRIPTION_MAX_LENGTH}
            aria-invalid={Boolean(errors.description) || undefined}
            placeholder="Describe the fault, what you did and how you verified it…"
            className={`resize-none rounded-lg border bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray ${
              errors.description ? "border-dangerBorder" : "border-borderGrayStrong"
            }`}
          />
        </EntryFormField>
        <EntryFormField label="Media" error={errors.photos}>
          <HistoryMediaPicker photos={draft.photos} onChange={(photos) => update({ photos })} />
        </EntryFormField>
        <div className="flex gap-3">
          <EntryFormField label="Hours" htmlFor="history-entry-hours" error={errors.hours} className="flex-1">
            <Input id="history-entry-hours" inputMode="decimal" value={draft.hours} onChange={(event) => update({ hours: event.target.value })} />
          </EntryFormField>
          <EntryFormField label="Downtime" htmlFor="history-entry-downtime" error={errors.downtime} className="flex-1">
            <Input
              id="history-entry-downtime"
              inputMode="decimal"
              placeholder="3.5 h"
              value={draft.downtime}
              onChange={(event) => update({ downtime: event.target.value })}
            />
          </EntryFormField>
        </div>
        {typeof navigator !== "undefined" && !navigator.onLine && (
          <span className="flex items-center gap-1.5 text-xs text-mutedGray">
            <Icon name="cloud" className="h-3.5 w-3.5" /> You&apos;re offline — the entry is saved on this device and syncs when back in range.
          </span>
        )}
        {saveError && <span role="alert" className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={isSaving}>
            <Icon name="check" />
            {isSaving ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
