"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "../icons/icon";

interface DrawerProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
}

// A panel that slides over the right edge, for a record's details beside
// the list it came from. Escape or the backdrop closes it.
export const Drawer = ({ title, children, onClose, widthClassName = "w-[480px]" }: DrawerProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-inkStatic/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`flex h-full max-w-full flex-col bg-surface shadow-xl ${widthClassName}`}
      >
        <div className="flex h-14 flex-none items-center border-b border-borderGray px-4">
          <span className="truncate text-[15px] font-medium text-ink">{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-bodyGray">
            <Icon name="x" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
