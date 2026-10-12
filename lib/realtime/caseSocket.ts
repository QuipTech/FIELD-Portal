import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/httpClient";
import { getAccessToken } from "../auth/authSession";

export const CASE_SOCKET_EVENTS = {
  caseUpdated: "case:updated",
  message: "case:message",
  event: "case:event",
  typing: "case:typing",
  join: "case:join",
  leave: "case:leave",
} as const;

// The API's live support-case channel. The token is read on every
// (re)connect, so a reconnect after a token refresh uses the new one.
export const connectCaseSocket = (): Socket =>
  io(`${API_BASE_URL}/support-cases`, {
    auth: (sendAuth) => sendAuth({ token: getAccessToken() }),
    transports: ["websocket"],
  });
