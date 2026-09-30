"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { createSupportCaseRequest, getSupportCaseOptionsRequest } from "@/lib/api/supportCasesApi";
import { CASE_CATEGORIES, CASE_PRIORITIES } from "@/lib/format/caseLabels";
import type { NewSupportCase } from "@/lib/types/supportCase";

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const selectClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink";

const EMPTY_CASE: NewSupportCase = { subject: "", category: "alarm", priority: "P3", machineId: "", description: "" };

// Raises a case and opens it, where the chat continues.
export const NewCaseModal = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();
  const options = useApiResource(getSupportCaseOptionsRequest, [], "Couldn't load your machines.");
  const [draft, setDraft] = useState<NewSupportCase>(EMPTY_CASE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canSubmit = draft.subject.trim().length >= 3 && draft.description.trim().length > 0;

  const update = <K extends keyof NewSupportCase>(key: K, value: NewSupportCase[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const created = await createSupportCaseRequest(requireAccessToken(), {
        ...draft,
        machineId: draft.machineId || undefined,
      });
      router.push(`/cases/${created.caseNumber}`);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't raise the case. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="New support case" onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Subject</span>
          <Input
            value={draft.subject}
            onChange={(event) => update("subject", event.target.value)}
            placeholder="e.g. Brake pressure alarm on cold start"
            maxLength={200}
          />
        </label>
        <div className="flex gap-2.5">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={fieldLabelClasses}>Type</span>
            <select
              value={draft.category}
              onChange={(event) => update("category", event.target.value as NewSupportCase["category"])}
              className={selectClasses}
            >
              {CASE_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={fieldLabelClasses}>Priority</span>
            <select
              value={draft.priority}
              onChange={(event) => update("priority", event.target.value as NewSupportCase["priority"])}
              className={selectClasses}
            >
              {CASE_PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Machine</span>
          <select
            value={draft.machineId}
            onChange={(event) => update("machineId", event.target.value)}
            className={selectClasses}
            disabled={options.isLoading}
          >
            <option value="">No specific machine</option>
            {options.data?.machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.modelName ? `${machine.label} · ${machine.modelName}` : machine.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>What&apos;s happening?</span>
          <textarea
            rows={5}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Fault codes, readings, what you've already tried…"
            maxLength={5000}
            className="resize-none rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
          />
        </label>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSubmit} disabled={isSaving || !canSubmit}>
            <Icon name="send" />
            {isSaving ? "Raising…" : "Raise case"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
