import { apiRequest } from "./httpClient";
import type { NotificationList } from "../types/notifications";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

// The signed-in user's notifications, newest first.
export const listNotificationsRequest = (
  accessToken: string,
  options: { unreadOnly: boolean; before?: string | null },
) => {
  const params = new URLSearchParams({ unreadOnly: String(options.unreadOnly) });
  if (options.before) params.set("before", options.before);
  return apiRequest<NotificationList>(`/notifications?${params.toString()}`, {
    headers: authorizationHeader(accessToken),
  });
};

export const getUnreadNotificationCountRequest = (accessToken: string) =>
  apiRequest<{ count: number }>("/notifications/unread-count", { headers: authorizationHeader(accessToken) });

// Both answer 204 with no body.
export const markNotificationReadRequest = (accessToken: string, notificationId: string) =>
  apiRequest<null>(`/notifications/${notificationId}/read`, { method: "POST", headers: authorizationHeader(accessToken) });

export const markAllNotificationsReadRequest = (accessToken: string) =>
  apiRequest<null>("/notifications/read-all", { method: "POST", headers: authorizationHeader(accessToken) });
