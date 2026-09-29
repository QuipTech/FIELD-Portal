"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { CreateMachineModelPayload } from "@/lib/types/machineLibrary";

interface NewModelModalProps {
  onCreate: (payload: CreateMachineModelPayload) => Promise<void>;
  onClose: () => void;
}

const CREATE_FAILED_MESSAGE = "Couldn't create the model. Please try again.";
const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

export const NewModelModal = ({ onCreate, onClose }: NewModelModalProps) => {
  const [manufacturerName, setManufacturerName] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const isComplete = Boolean(manufacturerName.trim() && name.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isComplete) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await onCreate({
        manufacturerName: manufacturerName.trim(),
        name: name.trim(),
        category: category.trim() || undefined,
      });
      onClose();
    } catch (error) {
      setCreateError(toApiErrorMessage(error, CREATE_FAILED_MESSAGE));
      setIsCreating(false);
    }
  };

  return (
    <Modal title="New model" onClose={isCreating ? undefined : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Manufacturer</span>
          <Input
            placeholder="CAT"
            value={manufacturerName}
            onChange={(event) => setManufacturerName(event.target.value)}
            maxLength={120}
            required
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Model</span>
          <Input placeholder="793F" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Category (optional)</span>
          <Input
            placeholder="haul truck"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={120}
          />
        </label>
        {createError && <span className="text-xs text-danger">{createError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!isComplete || isCreating}>
            {isCreating ? "Creating…" : "Create model"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
