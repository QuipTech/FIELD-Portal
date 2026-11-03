"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { listAdminOrganisationsRequest, listAdminUsersRequest } from "@/lib/api/adminUsersApi";
import type { AssignmentTargetType } from "@/lib/types/machineGroup";

export interface AssignTarget {
  id: string;
  name: string;
  // The organisation itself, or the person's.
  organisationName: string;
}

interface AssignTargetPickerProps {
  targetType: AssignmentTargetType;
  selectedId: string | null;
  onSelect: (target: AssignTarget) => void;
}

const SEARCH_DELAY_MS = 300;
const USER_RESULTS = 20;

const loadTargets = async (targetType: AssignmentTargetType, search: string): Promise<AssignTarget[]> => {
  const token = requireAccessToken();
  if (targetType === "organisation") {
    const term = search.toLowerCase();
    return (await listAdminOrganisationsRequest(token))
      .filter((organisation) => organisation.name.toLowerCase().includes(term))
      .map((organisation) => ({ id: organisation.id, name: organisation.name, organisationName: organisation.name }));
  }
  const { users } = await listAdminUsersRequest(token, { search, pageSize: USER_RESULTS });
  return users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    organisationName: user.organisation.name,
  }));
};

// A searchable list of every organisation, or of people across them.
export const AssignTargetPicker = ({ targetType, selectedId, onSelect }: AssignTargetPickerProps) => {
  const [search, setSearch] = useState("");
  const [targets, setTargets] = useState<AssignTarget[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setTargets(null);
    const timer = setTimeout(() => {
      loadTargets(targetType, search.trim())
        .then((found) => isCurrent && setTargets(found))
        .catch(() => isCurrent && setTargets([]));
    }, SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [targetType, search]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        icon="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={targetType === "organisation" ? "Search organisations" : "Search people by name or email"}
      />
      <div role="listbox" className="flex max-h-56 flex-col overflow-y-auto rounded-lg border border-borderGray">
        {!targets && (
          <div className="flex justify-center p-4 text-mutedGray">
            <LoadingSpinner />
          </div>
        )}
        {targets?.length === 0 && <p className="p-3 text-sm text-mutedGray">No matches.</p>}
        {targets?.map((target) => (
          <button
            key={target.id}
            type="button"
            role="option"
            aria-selected={target.id === selectedId}
            onClick={() => onSelect(target)}
            className={`flex flex-col border-b border-borderGray px-3 py-2 text-left text-sm last:border-b-0 ${
              target.id === selectedId ? "bg-primaryTint text-primaryTintText" : "hover:bg-fillGray"
            }`}
          >
            <span className="font-medium">{target.name}</span>
            {targetType === "user" && <span className="text-xs text-mutedGray">{target.organisationName}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
