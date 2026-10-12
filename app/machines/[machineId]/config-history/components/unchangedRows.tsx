"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { UnchangedItem } from "@/lib/types/configurationDiff";

// The closing "Unchanged · N other components & settings" row, which
// expands to list them.
export const UnchangedRows = ({ items }: { items: UnchangedItem[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="flex items-center gap-2 px-3.5 py-3 text-left hover:bg-surfaceGray"
      >
        <Tag>Unchanged</Tag>
        <span className="text-[15px] text-bodyGray">{items.length} other components &amp; settings</span>
        <Icon name="chevd" className={`ml-auto stroke-mutedGray transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded && (
        <ul className="flex flex-col border-t border-borderGray px-3.5 py-2">
          {items.map((item) => (
            <li key={item.componentName} className="flex items-center gap-3 py-1.5 text-[13px]">
              <span className="text-bodyGray">{item.componentName}</span>
              <span className="ml-auto font-mono text-mutedGray">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
