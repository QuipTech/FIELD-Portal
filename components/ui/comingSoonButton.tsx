"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ComingSoonButtonProps {
  children: ReactNode;
  label: string;
  className?: string;
}

const TOOLTIP_VISIBLE_MS = 2000;

export const ComingSoonButton = ({ children, label, className = "" }: ComingSoonButtonProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!showTooltip) return;
    const timer = setTimeout(() => setShowTooltip(false), TOOLTIP_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showTooltip]);

  return (
    <button
      type="button"
      aria-label={`${label} — coming soon`}
      onClick={() => setShowTooltip(true)}
      className={`relative flex-1 ${className}`}
    >
      {children}
      {showTooltip && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-inkStatic px-2.5 py-1 text-[11px] font-medium text-white shadow-md">
          Coming soon
        </span>
      )}
    </button>
  );
};
