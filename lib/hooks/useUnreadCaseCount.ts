"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "../auth/authSession";
import { getUnreadCaseCountRequest, type CaseThreadScope } from "../api/caseThreadApi";
import { subscribeToNewNotifications } from "../realtime/notificationSocket";

const POLL_INTERVAL_MS = 60_000;
// Fired after a case is marked read, so the nav badge updates at once.
const CASES_READ_EVENT = "field:cases-read";

export const announceCasesRead = () => window.dispatchEvent(new Event(CASES_READ_EVENT));

// The "Support cases" nav badge: cases with a reply you haven't read.
// Every reply also creates an in-app notification for the same people, so
// the notification socket is the live signal; plus on read, on focus, and
// every minute as a fallback. Failures keep the last count.
export const useUnreadCaseCount = (scope: CaseThreadScope, isEnabled = true): number => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    const accessToken = getAccessToken();
    if (!isEnabled || !accessToken || document.visibilityState === "hidden") return;
    getUnreadCaseCountRequest(accessToken, scope)
      .then((result) => setCount(result.count))
      .catch(() => undefined);
  }, [scope, isEnabled]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(CASES_READ_EVENT, refresh);
    const unsubscribe = subscribeToNewNotifications(refresh);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CASES_READ_EVENT, refresh);
    };
  }, [refresh]);

  return count;
};
