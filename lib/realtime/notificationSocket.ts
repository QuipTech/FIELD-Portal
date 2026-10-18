import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/httpClient";
import { getAccessToken } from "../auth/authSession";

// Sent by the API when a notification is created for the signed-in user.
const NOTIFICATION_CREATED_EVENT = "notification:new";

type Listener = () => void;

const listeners = new Set<Listener>();
let socket: Socket | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

// The API's live notification channel (the user's own room). One shared
// socket per tab: it connects with the first listener and closes with the
// last. The token is read on every (re)connect, so a reconnect after a
// token refresh uses the new one.
export const subscribeToNewNotifications = (listener: Listener): (() => void) => {
  listeners.add(listener);
  if (!socket) {
    socket = io(`${API_BASE_URL}/notifications`, {
      autoConnect: false,
      auth: (sendAuth) => sendAuth({ token: getAccessToken() }),
      transports: ["websocket"],
    });
    socket.on(NOTIFICATION_CREATED_EVENT, () => listeners.forEach((notify) => notify()));
    // Strict Mode/Fast Refresh may clean up this subscription immediately.
    // Start on the next task so that cleanup can cancel it before a socket opens.
    const pendingSocket = socket;
    connectTimer = setTimeout(() => {
      connectTimer = null;
      if (socket === pendingSocket && listeners.size > 0) pendingSocket.connect();
    }, 0);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (connectTimer !== null) clearTimeout(connectTimer);
      connectTimer = null;
      socket?.disconnect();
      socket = null;
    }
  };
};
