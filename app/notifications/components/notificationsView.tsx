"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons/icon";
import { ErrorToast } from "@/components/ui/errorToast";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationListItem } from "@/components/notifications/notificationListItem";

type Filter = "all" | "unread";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

export const NotificationsView = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const notifications = useNotifications(filter === "unread");

  const markAllRead = () =>
    notifications
      .markAllRead()
      .catch((error: unknown) => setActionError(toApiErrorMessage(error, "Couldn't mark them as read. Please try again.")));

  return (
    <AppShell
      topBar={
        <TopBar>
          <span className="text-[15px] text-bodyGray">Notifications</span>
        </TopBar>
      }
    >
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-medium text-ink">Notifications</h1>
          <div className="ml-2 flex gap-1.5">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filter === option.value ? "primary" : "default"}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                {option.value === "unread" && notifications.unreadCount > 0 ? ` · ${notifications.unreadCount}` : ""}
              </Button>
            ))}
          </div>
          <Button size="sm" className="ml-auto" disabled={notifications.unreadCount === 0} onClick={markAllRead}>
            <Icon name="check" className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
          {notifications.items.map((notification) => (
            <NotificationListItem key={notification.id} notification={notification} onOpen={notifications.markRead} />
          ))}
          {notifications.isLoading && (
            <span className="flex items-center justify-center gap-2 py-8 text-sm text-mutedGray">
              <LoadingSpinner /> Loading…
            </span>
          )}
          {!notifications.isLoading && notifications.error && (
            <span className="py-8 text-center text-sm text-danger">{notifications.error}</span>
          )}
          {!notifications.isLoading && !notifications.error && notifications.items.length === 0 && (
            <span className="py-10 text-center text-sm text-mutedGray">
              {filter === "unread"
                ? "You're all caught up."
                : "Replies on your cases, machines going down, reviewed AI answers and new documents will show up here."}
            </span>
          )}
        </div>
        {notifications.hasMore && !notifications.isLoading && (
          <Button className="self-center" onClick={notifications.loadMore}>
            Load more
          </Button>
        )}
      </main>
      {actionError && <ErrorToast key={actionError} message={actionError} onDismiss={() => setActionError(null)} />}
    </AppShell>
  );
};
