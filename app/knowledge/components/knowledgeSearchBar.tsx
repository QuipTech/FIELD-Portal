"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";

interface KnowledgeSearchBarProps {
  defaultValue?: string;
}

export const KnowledgeSearchBar = ({ defaultValue = "" }: KnowledgeSearchBarProps) => {
  const [query, setQuery] = useState(defaultValue);

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-borderGrayStrong bg-white px-3">
      <Icon name="search" className="stroke-mutedGray" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search manuals, procedures, bulletins…"
        className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="flex-none text-mutedGray hover:text-ink"
        >
          <Icon name="x" className="stroke-mutedGray" />
        </button>
      )}
    </div>
  );
};
