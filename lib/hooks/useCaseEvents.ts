"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CASE_SOCKET_EVENTS, connectCaseSocket } from "../realtime/caseSocket";
import type { CaseMessage } from "../types/caseMessage";
import type { SupportCase } from "../types/supportCase";

export interface CaseTypingEvent {
  caseNumber: number;
  userId: string;
  name: string;
}

interface CaseEventHandlers {
  // Any case in the organisation changed (or, with caseNumber, this one).
  onCaseUpdated?: (supportCase: SupportCase) => void;
  onMessage?: (caseNumber: number, message: CaseMessage) => void;
  onTyping?: (event: CaseTypingEvent) => void;
}

// Live case events for the page. With `caseNumber` it also joins that
// case's room — again after every reconnect — for its messages and typing.
// Handlers may change every render; the socket is kept for the page's life.
export const useCaseEvents = (handlers: CaseEventHandlers, caseNumber?: number) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = connectCaseSocket();
    socketRef.current = socket;
    socket.on("connect", () => {
      setIsConnected(true);
      if (caseNumber) socket.emit(CASE_SOCKET_EVENTS.join, { caseNumber });
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on(CASE_SOCKET_EVENTS.caseUpdated, (supportCase: SupportCase) =>
      handlersRef.current.onCaseUpdated?.(supportCase),
    );
    socket.on(CASE_SOCKET_EVENTS.message, (event: { caseNumber: number; message: CaseMessage }) =>
      handlersRef.current.onMessage?.(event.caseNumber, event.message),
    );
    socket.on(CASE_SOCKET_EVENTS.typing, (event: CaseTypingEvent) => handlersRef.current.onTyping?.(event));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [caseNumber]);

  const announceTyping = useCallback(() => {
    if (caseNumber) socketRef.current?.emit(CASE_SOCKET_EVENTS.typing, { caseNumber });
  }, [caseNumber]);

  return { isConnected, announceTyping };
};
