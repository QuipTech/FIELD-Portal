"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons/icon";

const VISIBLE_MS = 3000;

// A brief confirmation in the corner; dismisses itself.
export const SavedToast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-inkStatic px-4 py-3 text-sm text-white shadow-lg"
    >
      <Icon name="check" className="h-4 w-4" />
      {message}
    </div>
  );
};
