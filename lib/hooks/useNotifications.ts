"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "@/lib/api/notificationsApi";
import { announceNotificationsChanged } from "@/lib/hooks/useUnreadNotificationCount";
import { subscribeToNewNotifications } from "@/lib/realtime/notificationSocket";
import type { UserNotification } from "@/lib/types/notifications";

const LOAD_FAILED_MESSAGE = "Couldn't load your notifications. Please try again.";

// The notifications list for the All / Unread filter, with paging and
// read state (the /notifications page and the bell's dropdown). Marking
// read updates the list at once and every bell; a new notification
// reloads the first page.
export const useNotifications = (unreadOnly: boolean) => {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestLoadRef = useRef(0);

  const load = useCallback(
    async (before: string | null) => {
      const loadId = ++latestLoadRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const page = await listNotificationsRequest(requireAccessToken(), { unreadOnly, before });
        if (loadId !== latestLoadRef.current) return;
        setItems((current) => (before ? [...current, ...page.items] : page.items));
        setUnreadCount(page.unreadCount);
        setNextBefore(page.nextBefore);
      } catch (loadError) {
        if (loadId === latestLoadRef.current) setError(toApiErrorMessage(loadError, LOAD_FAILED_MESSAGE));
      } finally {
        if (loadId === latestLoadRef.current) setIsLoading(false);
      }
    },
    [unreadOnly],
  );

  useEffect(() => {
    void load(null);
    return subscribeToNewNotifications(() => void load(null));
  }, [load]);

  // Fire and forget: navigation shouldn't wait on it.
  const markRead = (notification: UserNotification) => {
    if (notification.isRead) return;
    setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
    markNotificationReadRequest(requireAccessToken(), notification.id)
      .then(announceNotificationsChanged)
      .catch(() => undefined);
  };

  // Rejects with the API error so the page can show it.
  const markAllRead = async () => {
    await markAllNotificationsReadRequest(requireAccessToken());
    setItems((current) => (unreadOnly ? [] : current.map((item) => ({ ...item, isRead: true }))));
    setUnreadCount(0);
    setNextBefore(unreadOnly ? null : nextBefore);
    announceNotificationsChanged();
  };

  return {
    items,
    unreadCount,
    hasMore: nextBefore !== null,
    isLoading,
    error,
    loadMore: () => load(nextBefore),
    markRead,
    markAllRead,
  };
};
