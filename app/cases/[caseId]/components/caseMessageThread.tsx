"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { formatShortDateTime } from "@/lib/format/shortDate";
import { getInitials } from "@/lib/format/nameInitials";
import type { CaseMessage } from "@/lib/types/caseMessage";

const DELETED_AUTHOR_NAME = "Former user";

// Scrolls to the newest message whenever one arrives.
export const CaseMessageThread = ({ messages }: { messages: CaseMessage[] }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return <p className="text-[15px] text-mutedGray">No messages yet on this case.</p>;
  }

  return (
    <div className="flex flex-col gap-3.5" aria-live="polite">
      {messages.map((message) => {
        const authorName = message.author?.name || DELETED_AUTHOR_NAME;
        return (
          <div key={message.id} className="flex flex-col gap-2.5 rounded-xl border border-borderGray bg-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar initials={getInitials(authorName)} size="sm" />
              <span className="text-[15px] font-medium text-ink">{authorName}</span>
              <Tag tone={message.authorRole === "support" ? "primary" : "default"}>
                {message.authorRole === "support" ? "Support" : "Reported"}
              </Tag>
              <span className="ml-auto text-xs text-mutedGray">{formatShortDateTime(message.createdAt)}</span>
            </div>
            <span className="whitespace-pre-wrap text-[15px] text-bodyGray">{message.body}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
