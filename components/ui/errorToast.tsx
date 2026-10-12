"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons/icon";

const VISIBLE_MS = 4000;

// A brief error in the corner; dismisses itself. Give it a new `key` to
// restart the timer when the same message is raised again.
export const ErrorToast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-dangerBorder bg-dangerTint px-4 py-3 text-sm text-danger shadow-lg"
    >
      <Icon name="alert" className="h-4 w-4 flex-none stroke-danger" />
      <span className="flex-1">{message}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="flex-none">
        <Icon name="x" className="h-4 w-4 stroke-danger" />
      </button>
    </div>
  );
};
