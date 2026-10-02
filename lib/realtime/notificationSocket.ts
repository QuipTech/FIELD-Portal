import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/httpClient";
import { getAccessToken } from "../auth/authSession";

// Sent by the API when a notification is created for the signed-in user.
const NOTIFICATION_CREATED_EVENT = "notification:new";

type Listener = () => void;

const listeners = new Set<Listener>();
let socket: Socket | null = null;

// The API's live notification channel (the user's own room). One shared
// socket per tab: it connects with the first listener and closes with the
// last. The token is read on every (re)connect, so a reconnect after a
// token refresh uses the new one.
export const subscribeToNewNotifications = (listener: Listener): (() => void) => {
  listeners.add(listener);
  if (!socket) {
    socket = io(`${API_BASE_URL}/notifications`, {
      auth: (sendAuth) => sendAuth({ token: getAccessToken() }),
      transports: ["websocket"],
    });
    socket.on(NOTIFICATION_CREATED_EVENT, () => listeners.forEach((notify) => notify()));
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      socket?.disconnect();
      socket = null;
    }
  };
};
