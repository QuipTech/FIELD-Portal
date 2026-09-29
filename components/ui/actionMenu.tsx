"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../icons/icon";

export interface ActionMenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  tone?: "default" | "danger";
}

interface ActionMenuProps {
  // Names the thing the menu acts on, for screen readers.
  label: string;
  items: ActionMenuItem[];
}

// A "⋯" button that opens a small menu of actions. Closes on selection,
// an outside click or Escape.
export const ActionMenu = ({ label, items }: ActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-lg leading-none text-bodyGray hover:bg-fillGray"
      >
        ⋯
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 flex min-w-[180px] flex-col gap-0.5 rounded-xl border border-borderGray bg-surface p-1.5 shadow-[0_10px_26px_rgba(30,32,36,0.14)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fillGray ${
                item.tone === "danger" ? "text-danger" : "text-bodyGray"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
