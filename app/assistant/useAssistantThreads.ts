"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getAssistantThreadRequest, listAssistantThreadsRequest } from "@/lib/api/aiAssistantApi";
import type { AssistantThreadSummary, ChatEntry } from "@/lib/types/aiAssistant";
import { readAssistantLaunchParams } from "./readAssistantLaunchParams";

export interface AssistantThreadsState {
  threads: AssistantThreadSummary[];
  isLoadingThreads: boolean;
  threadsError: string | null;
  // null while composing a new thread.
  activeThread: AssistantThreadSummary | null;
  messages: ChatEntry[];
  setMessages: Dispatch<SetStateAction<ChatEntry[]>>;
  isLoadingMessages: boolean;
  messagesError: string | null;
  openThread: (thread: AssistantThreadSummary) => Promise<void>;
  startNewThread: () => void;
  // Makes a just-saved new thread the active one and refreshes the rail.
  adoptThread: (thread: AssistantThreadSummary) => void;
}

// The Threads rail and the open thread's messages. The requested (else
// newest) thread opens on first load; a response for a thread no longer open is ignored.
export const useAssistantThreads = (): AssistantThreadsState => {
  const threadList = useApiResource(listAssistantThreadsRequest, [], "Couldn't load your threads.");
  const [activeThread, setActiveThread] = useState<AssistantThreadSummary | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);
  const hasOpenedInitialThreadRef = useRef(false);

  const openThread = useCallback(async (thread: AssistantThreadSummary) => {
    const requestId = ++latestRequestRef.current;
    const isCurrent = () => requestId === latestRequestRef.current;
    setActiveThread(thread);
    setMessages([]);
    setMessagesError(null);
    setIsLoadingMessages(true);
    try {
      const loaded = await getAssistantThreadRequest(requireAccessToken(), thread.id);
      if (isCurrent()) setMessages(loaded.messages);
    } catch (error) {
      if (isCurrent()) setMessagesError(toApiErrorMessage(error, "Couldn't open this thread."));
    } finally {
      if (isCurrent()) setIsLoadingMessages(false);
    }
  }, []);

  const startNewThread = useCallback(() => {
    latestRequestRef.current += 1;
    setActiveThread(null);
    setMessages([]);
    setMessagesError(null);
    setIsLoadingMessages(false);
  }, []);

  const { reload } = threadList;
  const adoptThread = useCallback(
    (thread: AssistantThreadSummary) => {
      setActiveThread(thread);
      reload();
    },
    [reload],
  );

  // /assistant?thread=<id> (e.g. from the dashboard) opens that thread
  // (a ?machine= launch starts a new one instead);
  // read from location rather than useSearchParams to keep the page static.
  useEffect(() => {
    if (hasOpenedInitialThreadRef.current || !threadList.data) return;
    hasOpenedInitialThreadRef.current = true;
    if (readAssistantLaunchParams().machineId) return;
    const requestedId = new URLSearchParams(window.location.search).get("thread");
    const initial = threadList.data.find((thread) => thread.id === requestedId) ?? threadList.data[0];
    if (initial) void openThread(initial);
  }, [threadList.data, openThread]);

  return {
    threads: threadList.data ?? [],
    isLoadingThreads: threadList.isLoading,
    threadsError: threadList.error,
    activeThread,
    messages,
    setMessages,
    isLoadingMessages,
    messagesError,
    openThread,
    startNewThread,
    adoptThread,
  };
};
