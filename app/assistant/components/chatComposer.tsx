"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";

export const ChatComposer = () => {
  const [draft, setDraft] = useState("");
  const { isLoaded, can } = usePermissions();
  const canAsk = isLoaded && can(PERMISSIONS.useAiAssistant);
  const deniedMessage = isLoaded && !canAsk ? describeMissingPermission(PERMISSIONS.useAiAssistant) : undefined;

  return (
    <div className="mt-auto flex flex-none items-center gap-2.5" title={deniedMessage}>
      <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-borderGrayStrong bg-surface px-3">
        {deniedMessage && <Icon name="lock" className="h-4 w-4 stroke-mutedGray" />}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={deniedMessage ? "Your role doesn't include the AI assistant" : "Ask about this machine…"}
          disabled={!canAsk}
          className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray disabled:cursor-not-allowed"
        />
      </div>
      <button
        type="button"
        aria-label="Voice input"
        disabled={!canAsk}
        className="mr-2 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="mic" className="stroke-current" />
      </button>
      <button
        type="button"
        aria-label="Send"
        disabled={!canAsk}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="send" />
      </button>
    </div>
  );
};
