"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";

export const KnowledgeFilterPills = () => {
  const [makeFilterVisible, setMakeFilterVisible] = useState(true);

  return (
    <div className="flex items-center gap-2">
      <Tag>
        Relevance
        <Icon name="chevd" className="h-3.5 w-3.5" />
      </Tag>
      {makeFilterVisible && (
        <Tag tone="primary">
          CAT 793F
          <button
            type="button"
            aria-label="Remove CAT 793F filter"
            onClick={() => setMakeFilterVisible(false)}
            className="flex-none"
          >
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </Tag>
      )}
      <span className="ml-auto text-xs text-mutedGray">86 results</span>
    </div>
  );
};
