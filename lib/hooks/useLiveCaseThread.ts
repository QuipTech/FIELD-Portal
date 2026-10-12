"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiResource } from "./useApiResource";
import { useCaseEvents } from "./useCaseEvents";
import { announceCasesRead } from "./useUnreadCaseCount";
import { useSignedInProfile } from "../auth/useSignedInProfile";
import { requireAccessToken } from "../api/requireAccessToken";
import {
  listCaseEventsRequest,
  listCaseMessagesRequest,
  markCaseReadRequest,
  postCaseMessageRequest,
  type CaseThreadScope,
} from "../api/caseThreadApi";
import type { CaseEvent, CaseMessage, NewCaseMessage } from "../types/caseMessage";
import type { SupportCase } from "../types/supportCase";

// How long "… is typing" stays up without a fresh typing event, and how
// often this browser announces its own typing.
const TYPING_VISIBLE_MS = 3_000;
const TYPING_ANNOUNCE_MS = 2_000;

// A message arrives twice — from the POST and over the socket — so append by id.
const appendById = <T extends { id: string }>(items: T[] | null, item: T): T[] => {
  const current = items ?? [];
  return current.some((existing) => existing.id === item.id) ? current : [...current, item];
};

// One case's thread (messages + system lines), kept live over the socket
// and marked read as it's seen. The same for customers and staff; scope
// picks the API routes, and the API decides what each may receive.
export const useLiveCaseThread = (
  scope: CaseThreadScope,
  caseNumber: number,
  onCaseUpdated: (supportCase: SupportCase) => void,
) => {
  const signedInProfile = useSignedInProfile();
  const messages = useApiResource(
    (token) => listCaseMessagesRequest(token, scope, caseNumber),
    [scope, caseNumber],
    "Couldn't load the messages.",
  );
  const events = useApiResource(
    (token) => listCaseEventsRequest(token, scope, caseNumber),
    [scope, caseNumber],
    "Couldn't load the case history.",
  );
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastAnnouncedAt = useRef(0);

  const markRead = useCallback(() => {
    markCaseReadRequest(requireAccessToken(), scope, caseNumber)
      .then(announceCasesRead)
      .catch(() => undefined);
  }, [scope, caseNumber]);

  useEffect(markRead, [markRead]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const { isConnected, announceTyping } = useCaseEvents(
    {
      onCaseUpdated: (updated) => {
        if (updated.caseNumber === caseNumber) onCaseUpdated(updated);
      },
      onMessage: (messageCaseNumber, message) => {
        if (messageCaseNumber !== caseNumber) return;
        messages.setData((current) => appendById(current, message));
        setTypingName(null);
        if (document.visibilityState === "visible") markRead();
      },
      onEvent: (eventCaseNumber, event) => {
        if (eventCaseNumber === caseNumber) events.setData((current) => appendById(current, event));
      },
      onTyping: (event) => {
        if (event.caseNumber !== caseNumber || event.userId === signedInProfile?.user.id) return;
        setTypingName(event.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(null), TYPING_VISIBLE_MS);
      },
    },
    caseNumber,
  );

  const sendMessage = async (message: NewCaseMessage): Promise<void> => {
    const sent = await postCaseMessageRequest(requireAccessToken(), scope, caseNumber, message);
    messages.setData((current) => appendById(current, sent));
    // A reply can change the case (e.g. waiting on customer → open).
    events.reload();
  };

  const noteTyping = (isInternal: boolean) => {
    const now = Date.now();
    if (now - lastAnnouncedAt.current < TYPING_ANNOUNCE_MS) return;
    lastAnnouncedAt.current = now;
    announceTyping(isInternal);
  };

  const appendEvents = (added: CaseEvent[]) =>
    events.setData((current) => added.reduce((list, event) => appendById(list, event), current ?? []));

  return {
    messages: messages.data ?? ([] as CaseMessage[]),
    events: events.data ?? ([] as CaseEvent[]),
    isLoading: messages.isLoading && !messages.data,
    error: messages.error,
    reload: () => {
      messages.reload();
      events.reload();
    },
    reloadEvents: events.reload,
    appendEvents,
    typingName,
    isLive: isConnected,
    sendMessage,
    noteTyping,
  };
};
