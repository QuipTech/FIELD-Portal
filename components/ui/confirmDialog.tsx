"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  // Turns a rejected onConfirm into the message shown in the dialog.
  toErrorMessage: (error: unknown) => string;
  // Holds the confirm button back, e.g. until a typed confirmation matches.
  isConfirmDisabled?: boolean;
}

// A yes/no dialog for destructive actions; stays open with the error if
// the action fails, so the user can retry or cancel.
export const ConfirmDialog = ({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  toErrorMessage,
  isConfirmDisabled = false,
}: ConfirmDialogProps) => {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setIsWorking(false);
    }
  };

  return (
    <Modal title={title} onClose={isWorking ? undefined : onClose} widthClassName="w-[420px]">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="text-sm text-bodyGray">{children}</div>
        {errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isWorking}>
            Cancel
          </Button>
          <Button variant="danger" className="ml-auto" onClick={handleConfirm} disabled={isWorking || isConfirmDisabled}>
            {isWorking ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
