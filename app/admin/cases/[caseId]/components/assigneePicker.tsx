"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listSupportStaffRequest } from "@/lib/api/adminSupportCasesApi";
import { abbreviateName, getInitials } from "@/lib/format/nameInitials";
import type { CasePerson } from "@/lib/types/supportCase";
import { StaffOption } from "./staffOption";
import { StaffMenuAction } from "./staffMenuAction";

interface AssigneePickerProps {
  assignee: CasePerson | null;
  currentUserId: string | null;
  isBusy: boolean;
  onAssign: (assigneeId: string | null) => void;
}

// A13c: the admin's assign dropdown — search support staff (with how many
// open cases each has), assign to me, or unassign.
export const AssigneePicker = ({ assignee, currentUserId, isBusy, onAssign }: AssigneePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const staff = useApiResource(listSupportStaffRequest, [], "Couldn't load support staff.");
  const term = query.trim().toLowerCase();
  const matches = (staff.data ?? []).filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(term));
  const canAssignToMe = currentUserId !== null && assignee?.id !== currentUserId;

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const choose = (assigneeId: string | null) => {
    setIsOpen(false);
    setQuery("");
    onAssign(assigneeId);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isBusy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-11 w-full items-center gap-2.5 rounded-lg bg-surface px-3 text-left text-[15px] disabled:opacity-70"
      >
        {assignee ? (
          <>
            <Avatar initials={getInitials(assignee.name)} imageSrc={assignee.avatarUrl ?? undefined} size="md" />
            <span className="truncate text-ink">{abbreviateName(assignee.name)}</span>
          </>
        ) : (
          <span className="text-amber">Unassigned</span>
        )}
        <Icon name="chevd" className="ml-auto h-4 w-4 stroke-bodyGray" />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 flex w-[300px] flex-col gap-1 rounded-2xl border border-borderGray bg-surface p-2.5 shadow-xl">
          <Input
            autoFocus
            icon="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search support staff"
            aria-label="Search support staff"
            className="mb-1"
          />
          <div role="listbox" aria-label="Support staff" className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {staff.isLoading && !staff.data && (
              <span className="flex justify-center p-3 text-mutedGray">
                <LoadingSpinner />
              </span>
            )}
            {staff.error && <span className="block p-3 text-xs text-danger">{staff.error}</span>}
            {staff.data && matches.length === 0 && (
              <span className="block p-3 text-sm text-mutedGray">No support staff match “{query}”.</span>
            )}
            {matches.map((member) => (
              <StaffOption
                key={member.id}
                member={member}
                isSelected={member.id === assignee?.id}
                onSelect={() => choose(member.id)}
              />
            ))}
          </div>
          <div className="mt-1 border-t border-borderGray pt-1.5">
            <StaffMenuAction icon="user" label="Assign to me" disabled={!canAssignToMe} onClick={() => choose(currentUserId)} />
            <StaffMenuAction icon="x" label="Unassign" disabled={!assignee} onClick={() => choose(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
