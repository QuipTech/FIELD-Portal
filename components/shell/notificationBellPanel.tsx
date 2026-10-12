"use client";

import Link from "next/link";
import { useState } from "react";
import { LoadingSpinner } from "../ui/loadingSpinner";
import { NotificationListItem } from "../notifications/notificationListItem";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

const MAX_SHOWN = 8;

interface NotificationBellPanelProps {
  onClose: () => void;
}

// The bell's dropdown: the latest notifications, mark all read, and a
// link to the full list. Opening one marks it read and goes to its
// machine, case or page.
export const NotificationBellPanel = ({ onClose }: NotificationBellPanelProps) => {
  const notifications = useNotifications(false);
  const [markAllError, setMarkAllError] = useState<string | null>(null);

  const markAllRead = () => {
    setMarkAllError(null);
    notifications
      .markAllRead()
      .catch((error: unknown) => setMarkAllError(toApiErrorMessage(error, "Couldn't mark them read.")));
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-[42px] z-40 flex w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-borderGray bg-surface shadow-lg"
    >
      <div className="flex items-center gap-2 border-b border-borderGray px-4 py-3">
        <span className="text-sm font-medium text-ink">Notifications</span>
        {notifications.unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="ml-auto text-xs text-primary hover:underline">
            Mark all as read
          </button>
        )}
      </div>
      {markAllError && <span className="px-4 pt-2 text-xs text-danger">{markAllError}</span>}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.isLoading && notifications.items.length === 0 && (
          <span className="flex items-center gap-2 px-4 py-6 text-sm text-mutedGray">
            <LoadingSpinner /> Loading…
          </span>
        )}
        {notifications.error && <span className="block px-4 py-6 text-sm text-danger">{notifications.error}</span>}
        {!notifications.isLoading && !notifications.error && notifications.items.length === 0 && (
          <span className="block px-4 py-6 text-sm text-mutedGray">You&apos;re all caught up.</span>
        )}
        {notifications.items.slice(0, MAX_SHOWN).map((notification) => (
          <NotificationListItem
            key={notification.id}
            notification={notification}
            onOpen={(opened) => {
              notifications.markRead(opened);
              onClose();
            }}
          />
        ))}
      </div>
      <Link
        href="/notifications"
        onClick={onClose}
        className="border-t border-borderGray px-4 py-2.5 text-center text-sm text-primary hover:bg-fillGray/60"
      >
        View all notifications
      </Link>
    </div>
  );
};
