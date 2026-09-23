"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";

export const ChatComposer = () => {
  const [draft, setDraft] = useState("");

  return (
    <div className="mt-auto flex flex-none items-center gap-2.5">
      <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-borderGrayStrong bg-white px-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this machine…"
          className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray"
        />
      </div>
      <button type="button" aria-label="Voice input" className="mr-2 text-slate-400 hover:text-slate-600">
        <Icon name="mic" className="stroke-current" />
      </button>
      <button className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary text-white">
        <Icon name="send" />
      </button>
    </div>
  );
};
