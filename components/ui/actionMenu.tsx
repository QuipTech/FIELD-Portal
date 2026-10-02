"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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

const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;

// Fixed to the viewport under the button (above it when there's no room
// below), right edges aligned.
const placeMenu = (button: HTMLElement, menu: HTMLElement): CSSProperties => {
  const anchor = button.getBoundingClientRect();
  const fitsBelow = anchor.bottom + MENU_GAP_PX + menu.offsetHeight <= window.innerHeight - VIEWPORT_MARGIN_PX;
  return {
    position: "fixed",
    right: Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - anchor.right),
    top: fitsBelow
      ? anchor.bottom + MENU_GAP_PX
      : Math.max(VIEWPORT_MARGIN_PX, anchor.top - MENU_GAP_PX - menu.offsetHeight),
  };
};

// A "⋯" button that opens a small menu of actions. The menu renders in a
// portal on <body>, so tables and cards that clip their overflow can't hide
// it. Closes on selection, an outside click, Escape, scrolling or resizing.
export const ActionMenu = ({ label, items }: ActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Measured before paint, so the menu never flashes in the wrong place.
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current && menuRef.current) {
      setMenuStyle(placeMenu(buttonRef.current, menuRef.current));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    // Capture: a scrolling table or panel moves the button away from the menu.
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setMenuStyle({ position: "fixed", visibility: "hidden" });
          setIsOpen((open) => !open);
        }}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-lg leading-none text-bodyGray hover:bg-fillGray"
      >
        ⋯
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="z-50 flex min-w-[180px] flex-col gap-0.5 rounded-xl border border-borderGray bg-surface p-1.5 shadow-[0_10px_26px_rgba(30,32,36,0.14)]"
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
          </div>,
          document.body,
        )}
    </>
  );
};
