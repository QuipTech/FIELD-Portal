"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "../auth/authSession";
import { getUnreadNotificationCountRequest } from "../api/notificationsApi";
import { subscribeToNewNotifications } from "../realtime/notificationSocket";

const POLL_INTERVAL_MS = 60_000;
// Fired after notifications are marked read, so every bell updates at once.
export const NOTIFICATIONS_CHANGED_EVENT = "field:notifications-changed";

export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

// The bell's badge: refreshed live when a notification arrives (socket),
// whenever notifications are read, when the tab regains focus, and every
// minute as a fallback. Failures keep the last count.
export const useUnreadNotificationCount = (): number => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    const accessToken = getAccessToken();
    if (!accessToken || document.visibilityState === "hidden") return;
    getUnreadNotificationCountRequest(accessToken)
      .then((result) => setCount(result.count))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    const unsubscribe = subscribeToNewNotifications(refresh);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return count;
};
