"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { AssistantMachine, AssistantSource, ChatEntry } from "@/lib/types/aiAssistant";
import { ChatMessageBubble } from "./chatMessageBubble";

interface ChatMessageListProps {
  messages: ChatEntry[];
  machine: AssistantMachine | null;
  isLoading: boolean;
  error: string | null;
  onOpenSource: (source: AssistantSource) => void;
}

// The question an answer replies to: the nearest user message before it.
const findQuestion = (messages: ChatEntry[], answerIndex: number): string =>
  messages
    .slice(0, answerIndex)
    .reverse()
    .find((message) => message.role === "user")?.content ?? "";

export const ChatMessageList = ({ messages, machine, isLoading, error, onOpenSource }: ChatMessageListProps) => {
  const endRef = useRef<HTMLDivElement>(null);
  const lastContentLength = messages.at(-1)?.content.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastContentLength]);

  if (isLoading || error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-mutedGray">
        {isLoading ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner /> Loading thread…
          </span>
        ) : (
          <span className="text-danger">{error}</span>
        )}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaryTint text-primaryTintText">
          <Icon name="spark" />
        </span>
        <span className="text-[15px] font-medium text-ink">Ask about a fault code, spec or procedure</span>
        <span className="max-w-sm text-sm text-mutedGray">
          Answers come only from approved manuals and the machine&apos;s service history, with sources. Attach a photo
          of the part if it helps.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
      {messages.map((message, index) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          question={message.role === "assistant" ? findQuestion(messages, index) : undefined}
          machine={machine}
          onOpenSource={onOpenSource}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
};
