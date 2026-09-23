"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons/icon";

export interface SearchSelectOption {
  value: string;
  group: string;
  label: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const groupOptions = (options: SearchSelectOption[]) => {
  const groups = new Map<string, SearchSelectOption[]>();
  options.forEach((option) => {
    const existing = groups.get(option.group) ?? [];
    groups.set(option.group, [...existing, option]);
  });
  return Array.from(groups.entries());
};

export const SearchSelect = ({ options, value, onChange, placeholder = "Search components…" }: SearchSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption ? `${selectedOption.group} › ${selectedOption.label}` : "";

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? options.filter((option) => `${option.group} ${option.label}`.toLowerCase().includes(term))
      : options;
    return groupOptions(matches);
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const openDropdown = () => {
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (option: SearchSelectOption) => {
    onChange(option.value);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={openDropdown}
        className="relative flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm"
      >
        <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {isOpen ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder={selectedLabel || placeholder}
            className="w-full border-none bg-transparent pl-10 pr-10 text-sm text-ink outline-none placeholder:text-mutedGray"
          />
        ) : (
          <span className={`w-full truncate pl-10 pr-10 ${selectedLabel ? "text-ink" : "text-mutedGray"}`}>
            {selectedLabel || placeholder}
          </span>
        )}
        <Icon name="chevd" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {filteredGroups.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-mutedGray">No components match “{query}”</div>
          ) : (
            filteredGroups.map(([group, groupOptionsList]) => (
              <div key={group} className="flex flex-col">
                <span className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-mutedGray">
                  {group}
                </span>
                {groupOptionsList.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex items-center rounded-lg px-3 py-2 text-left text-sm ${
                      option.value === value ? "bg-primaryTint text-primary" : "text-ink hover:bg-fillGray"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
