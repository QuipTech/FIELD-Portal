"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../icons/icon";

interface CollapsibleSearchProps {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const CollapsibleSearch = ({ placeholder, value, onChange }: CollapsibleSearchProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = value !== undefined;
  const query = isControlled ? value : internalQuery;

  const updateQuery = (next: string) => {
    onChange?.(next);
    if (!isControlled) {
      setInternalQuery(next);
    }
  };

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    inputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  const handleBlur = () => {
    if (query.trim() === "") {
      setIsSearchOpen(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="flex items-center">
      <button
        onClick={() => setIsSearchOpen(true)}
        aria-label="Search"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-mutedGray hover:bg-fillGray hover:text-ink"
      >
        <Icon name="search" />
      </button>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`h-9 rounded-lg border bg-white text-[15px] text-ink outline-none transition-all duration-300 ease-in-out placeholder:text-mutedGray ${
          isSearchOpen
            ? "pointer-events-auto ml-1 w-64 border-borderGrayStrong px-3 opacity-100"
            : "pointer-events-none ml-0 w-0 border-transparent px-0 opacity-0"
        }`}
      />
    </div>
  );
};
