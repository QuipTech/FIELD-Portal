"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface TreeNodeNameModalProps {
  title: string;
  fieldLabel: string;
  submitLabel: string;
  initialName?: string;
  placeholder?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save. Please try again.";

// Adds or renames a system or component — one name field.
export const TreeNodeNameModal = ({
  title,
  fieldLabel,
  submitLabel,
  initialName = "",
  placeholder,
  onSubmit,
  onClose,
}: TreeNodeNameModalProps) => {
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const trimmedName = name.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedName) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSubmit(trimmedName);
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={isSaving ? undefined : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{fieldLabel}</span>
          <Input
            placeholder={placeholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            autoFocus
          />
        </label>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!trimmedName || isSaving}>
            {isSaving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
