"use client";

import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/components/ui/emptyState";
import type { CaseEvent, CaseMessage } from "@/lib/types/caseMessage";
import { CaseMessageBubble, type ThreadPerspective } from "./caseMessageBubble";
import { CaseEventLine } from "./caseEventLine";

type ThreadItem = { kind: "message"; item: CaseMessage } | { kind: "event"; item: CaseEvent };

const toTimeline = (messages: CaseMessage[], events: CaseEvent[]): ThreadItem[] =>
  [
    ...messages.map((item): ThreadItem => ({ kind: "message", item })),
    ...events.map((item): ThreadItem => ({ kind: "event", item })),
  ].sort((a, b) => a.item.createdAt.localeCompare(b.item.createdAt));

// The one shared thread: messages and system lines in time order.
// Scrolls to the newest entry whenever one arrives.
interface CaseThreadProps {
  messages: CaseMessage[];
  events: CaseEvent[];
  // Whose screen this is: their own messages go on the right.
  perspective: ThreadPerspective;
  // Staff see the customer's company beside their name.
  companyName?: string;
}

export const CaseThread = ({ messages, events, perspective, companyName }: CaseThreadProps) => {
  const endRef = useRef<HTMLDivElement>(null);
  const timeline = useMemo(() => toTimeline(messages, events), [messages, events]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length]);

  if (timeline.length === 0) {
    return <EmptyState icon="msg" title="No messages yet" description="Replies on this case will appear here." />;
  }

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      {timeline.map((entry) =>
        entry.kind === "message" ? (
          <CaseMessageBubble key={`m-${entry.item.id}`} message={entry.item} perspective={perspective} companyName={companyName} />
        ) : (
          <CaseEventLine key={`e-${entry.item.id}`} event={entry.item} />
        ),
      )}
      <div ref={endRef} />
    </div>
  );
};
