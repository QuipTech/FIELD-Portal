"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

export interface PromptField {
  name: string;
  label: string;
  type?: "text" | "money" | "number";
  placeholder?: string;
}

interface AdminPromptDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  fields: PromptField[];
  confirmVariant?: "primary" | "danger";
  // Values by field name: money as whole cents, numbers as numbers.
  onConfirm: (values: Record<string, string | number>) => Promise<void>;
  onClose: () => void;
}

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const toValue = (field: PromptField, text: string): string | number | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (field.type === "money") {
    const dollars = Number(trimmed.replace(/[$,\s]/g, ""));
    return Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
  }
  if (field.type === "number") {
    const value = Number(trimmed);
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  return trimmed;
};

// A confirm dialog that asks for a few values first (every field required),
// for the admin billing actions: suspend, Enterprise contract, credit
// note, onboarding.
export const AdminPromptDialog = ({
  title,
  description,
  confirmLabel,
  fields,
  confirmVariant = "primary",
  onConfirm,
  onClose,
}: AdminPromptDialogProps) => {
  const [texts, setTexts] = useState<Record<string, string>>({});
  const values = Object.fromEntries(fields.map((field) => [field.name, toValue(field, texts[field.name] ?? "")]));
  const isComplete = fields.every((field) => values[field.name] !== null);
  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      isConfirmDisabled={!isComplete}
      onConfirm={() => onConfirm(values as Record<string, string | number>)}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "That didn't work. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>{description}</p>
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-sm text-ink">
            {field.label}
            <input
              value={texts[field.name] ?? ""}
              onChange={(event) => setTexts((current) => ({ ...current, [field.name]: event.target.value }))}
              inputMode={field.type === "text" || !field.type ? "text" : "decimal"}
              placeholder={field.placeholder}
              maxLength={500}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </ConfirmDialog>
  );
};
