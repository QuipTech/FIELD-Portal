"use client";

import { useEffect, useRef, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useCaseEvents } from "@/lib/hooks/useCaseEvents";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  getSupportCaseRequest,
  listCaseMessagesRequest,
  postCaseMessageRequest,
  updateSupportCaseRequest,
} from "@/lib/api/supportCasesApi";
import type { CaseMessage } from "@/lib/types/caseMessage";
import type { SupportCaseChanges } from "@/lib/types/supportCase";

// How long "… is typing" stays up without a fresh typing event, and how
// often this browser announces its own typing.
const TYPING_VISIBLE_MS = 3_000;
const TYPING_ANNOUNCE_MS = 2_000;

// A reply arrives twice — from the POST and over the socket — so append by id.
const appendMessage = (messages: CaseMessage[] | null, message: CaseMessage): CaseMessage[] => {
  const current = messages ?? [];
  return current.some((existing) => existing.id === message.id) ? current : [...current, message];
};

// One case and its chat, kept live over the socket.
export const useCaseThread = (caseNumber: number) => {
  const signedInProfile = useSignedInProfile();
  const supportCase = useApiResource((token) => getSupportCaseRequest(token, caseNumber), [caseNumber], "Couldn't load this case.");
  const messages = useApiResource((token) => listCaseMessagesRequest(token, caseNumber), [caseNumber], "Couldn't load the messages.");
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastAnnouncedAt = useRef(0);

  const { isConnected, announceTyping } = useCaseEvents(
    {
      onCaseUpdated: (updated) => {
        if (updated.caseNumber === caseNumber) supportCase.setData(updated);
      },
      onMessage: (messageCaseNumber, message) => {
        if (messageCaseNumber !== caseNumber) return;
        messages.setData((current) => appendMessage(current, message));
        setTypingName(null);
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

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const sendReply = async (body: string): Promise<void> => {
    const message = await postCaseMessageRequest(requireAccessToken(), caseNumber, body);
    messages.setData((current) => appendMessage(current, message));
  };

  const updateCase = async (changes: SupportCaseChanges): Promise<void> => {
    supportCase.setData(await updateSupportCaseRequest(requireAccessToken(), caseNumber, changes));
  };

  const noteTyping = () => {
    const now = Date.now();
    if (now - lastAnnouncedAt.current < TYPING_ANNOUNCE_MS) return;
    lastAnnouncedAt.current = now;
    announceTyping();
  };

  return { supportCase, messages, typingName, isLive: isConnected, sendReply, updateCase, noteTyping };
};
