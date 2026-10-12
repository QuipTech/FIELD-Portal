"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { askAssistantRequest } from "@/lib/api/aiAssistantApi";
import type { AskStreamEvent, AttachedPhoto, AssistantThreadSummary, ChatEntry } from "@/lib/types/aiAssistant";

const UNREACHABLE_MESSAGE = "Couldn't reach the assistant. Check your connection and try again.";
const CUT_OFF_MESSAGE = "The answer was cut off. Try again.";

interface AskAssistantOptions {
  activeThread: AssistantThreadSummary | null;
  // Context for a new thread; an existing thread keeps its own.
  machineId: string;
  // Answer the next question from this document only (then cleared).
  documentId: string | null;
  onDocumentUsed: () => void;
  setMessages: Dispatch<SetStateAction<ChatEntry[]>>;
  onThreadSaved: (conversationId: string, question: string) => void;
}

const newEntry = (id: string, role: ChatEntry["role"], content: string): ChatEntry => ({
  id,
  role,
  content,
  createdAt: new Date().toISOString(),
  sources: [],
  citedIndexes: [],
});

// Sends a question and streams the answer into the message list. A
// failed question is taken back off the list (nothing was saved) and
// `ask` resolves false so the composer can restore it.
export const useAskAssistant = ({
  activeThread,
  machineId,
  documentId,
  onDocumentUsed,
  setMessages,
  onThreadSaved,
}: AskAssistantOptions) => {
  const [isAnswering, setIsAnswering] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => cancel, [cancel]);

  const ask = async (question: string, photo: AttachedPhoto | null): Promise<boolean> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const questionId = `pending-question-${Date.now()}`;
    const answerId = `pending-answer-${Date.now()}`;
    const updateAnswer = (change: (entry: ChatEntry) => ChatEntry) =>
      setMessages((current) => current.map((entry) => (entry.id === answerId ? change(entry) : entry)));
    setMessages((current) => [
      ...current,
      { ...newEntry(questionId, "user", question), imagePreviewUrl: photo?.previewUrl },
      { ...newEntry(answerId, "assistant", ""), isStreaming: true },
    ]);
    setIsAnswering(true);
    setAskError(null);

    // Mutated by stream events, so kept in an object TypeScript won't narrow.
    const outcome = { conversationId: activeThread?.id ?? null, isComplete: false, failure: null as string | null };
    const handleEvent = (event: AskStreamEvent) => {
      if (event.event === "start") {
        outcome.conversationId = event.data.conversationId;
        updateAnswer((entry) => ({ ...entry, sources: event.data.sources }));
      } else if (event.event === "delta") {
        updateAnswer((entry) => ({ ...entry, content: entry.content + event.data.text }));
      } else if (event.event === "done") {
        outcome.isComplete = true;
        setMessages((current) =>
          current.map((entry) => {
            if (entry.id === questionId) return { ...entry, id: event.data.userMessageId };
            if (entry.id !== answerId) return entry;
            return { ...entry, id: event.data.assistantMessageId, citedIndexes: event.data.citedIndexes, isStreaming: false };
          }),
        );
      } else {
        outcome.failure = event.data.message;
      }
    };

    try {
      await askAssistantRequest(
        requireAccessToken(),
        {
          question,
          conversationId: activeThread?.id,
          machineId: activeThread ? undefined : machineId || undefined,
          documentId: documentId ?? undefined,
          image: photo ? { mediaType: photo.mediaType, data: photo.data } : undefined,
        },
        { onEvent: handleEvent, signal: controller.signal },
      );
      if (!outcome.isComplete) outcome.failure ??= CUT_OFF_MESSAGE;
    } catch (error) {
      outcome.failure = controller.signal.aborted ? null : toApiErrorMessage(error, UNREACHABLE_MESSAGE);
    } finally {
      setIsAnswering(false);
    }

    if (!outcome.isComplete) {
      setMessages((current) => current.filter((entry) => entry.id !== questionId && entry.id !== answerId));
      if (outcome.failure) setAskError(outcome.failure);
      return false;
    }
    if (documentId) onDocumentUsed();
    if (outcome.conversationId) onThreadSaved(outcome.conversationId, question);
    return true;
  };

  return { ask, cancel, isAnswering, askError, clearAskError: () => setAskError(null) };
};
