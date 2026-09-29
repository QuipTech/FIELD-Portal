"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { SavedToast } from "./savedToast";

interface AiLogRetentionCardProps {
  months: number;
  allowedMonths: number[];
  onSave: (months: number) => Promise<void>;
}

export const AiLogRetentionCard = ({ months, allowedMonths, onSave }: AiLogRetentionCardProps) => {
  const [selected, setSelected] = useState(months);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(selected);
      setToast(`AI query logs are now kept for ${selected} months.`);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't save the retention period. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium text-slate-800">AI query log retention</span>
          <span className="text-xs text-slate-500">
            Assistant conversations older than this are deleted nightly. Usage metering is kept regardless.
          </span>
        </div>
        <select
          aria-label="AI query log retention"
          value={selected}
          onChange={(event) => setSelected(Number(event.target.value))}
          className="h-9 rounded-lg border border-borderGrayStrong bg-surface px-3 text-sm text-ink"
        >
          {allowedMonths.map((option) => (
            <option key={option} value={option}>
              {option} months
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={handleSave} disabled={isSaving || selected === months}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
      {saveError && <span className="text-xs text-danger">{saveError}</span>}
      {toast && <SavedToast message={toast} onDismiss={dismissToast} />}
    </div>
  );
};
