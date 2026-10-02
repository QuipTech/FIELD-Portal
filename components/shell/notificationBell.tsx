"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons/icon";
import { toneChipClasses } from "../ui/tone";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { NotificationBellPanel } from "./notificationBellPanel";

const MAX_BADGE_COUNT = 99;

// The header bell: a live unread badge, and a dropdown of the latest
// notifications. Closes on an outside click or Escape.
export const NotificationBell = () => {
  const unread = useUnreadNotificationCount();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

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

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-lg transition-colors ${toneChipClasses.amber}`}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-medium leading-none text-white">
            {unread > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unread}
          </span>
        )}
      </button>
      {isOpen && <NotificationBellPanel onClose={() => setIsOpen(false)} />}
    </div>
  );
};
