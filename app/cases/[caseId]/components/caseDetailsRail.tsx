"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/icon";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getSupportCaseOptionsRequest } from "@/lib/api/supportCasesApi";
import { CASE_PRIORITIES, CASE_STATUS_LABELS } from "@/lib/format/caseLabels";
import { formatShortDateTime } from "@/lib/format/shortDate";
import type { CasePriority, CaseStatus, SupportCase, SupportCaseChanges } from "@/lib/types/supportCase";

interface CaseDetailsRailProps {
  item: SupportCase;
  onChange: (changes: SupportCaseChanges) => Promise<void>;
}

const railLabelClasses = "text-xs font-semibold uppercase tracking-wider text-indigo-300/70";
const pillClasses =
  "h-9 w-full appearance-none rounded-xl bg-surface px-3 pr-8 text-sm text-slate-800 shadow-sm disabled:cursor-default";

const RailField = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className={railLabelClasses}>{label}</span>
    <span className="relative flex items-center">
      {children}
      <Icon name="chevd" className="pointer-events-none absolute right-3 h-3.5 w-3.5 stroke-mutedGray" />
    </span>
  </label>
);

// Assignee, status and priority are editable with support.manage;
// everyone else sees them read-only.
export const CaseDetailsRail = ({ item, onChange }: CaseDetailsRailProps) => {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.manageSupportCases);
  const options = useApiResource(getSupportCaseOptionsRequest, [], "Couldn't load assignees.");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLocked = !canManage || isSaving;

  const save = async (changes: SupportCaseChanges) => {
    setIsSaving(true);
    setError(null);
    await onChange(changes)
      .catch((saveError: unknown) => setError(toApiErrorMessage(saveError, "Couldn't save that change.")))
      .finally(() => setIsSaving(false));
  };

  const assignees = options.data?.assignees ?? [];
  const isAssigneeListed = !item.assignee || assignees.some((person) => person.id === item.assignee?.id);

  return (
    <div className="flex w-[230px] flex-none flex-col gap-3 rounded-2xl bg-[#2D1B69] p-2.5">
      <span className={`pt-1 ${railLabelClasses}`}>Details</span>
      <div className="flex flex-col gap-1">
        <span className={railLabelClasses}>Asset</span>
        <span className="text-[15px] font-semibold text-white">
          {item.machine
            ? [item.machine.label, item.machine.modelName].filter(Boolean).join(" · ")
            : "No specific machine"}
        </span>
      </div>
      <RailField label="Assignee">
        <select
          className={pillClasses}
          value={item.assignee?.id ?? ""}
          disabled={isLocked}
          onChange={(event) => save({ assigneeId: event.target.value || null })}
        >
          <option value="">Unassigned</option>
          {!isAssigneeListed && item.assignee && <option value={item.assignee.id}>{item.assignee.name}</option>}
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </RailField>
      <RailField label="Status">
        <select
          className={pillClasses}
          value={item.status}
          disabled={isLocked}
          onChange={(event) => save({ status: event.target.value as CaseStatus })}
        >
          {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </RailField>
      <RailField label="Priority">
        <select
          className={pillClasses}
          value={item.priority}
          disabled={isLocked}
          onChange={(event) => save({ priority: event.target.value as CasePriority })}
        >
          {CASE_PRIORITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </RailField>
      {error && <span className="text-xs text-red-200">{error}</span>}
      <span className={`mt-1 border-t border-white/10 pt-4 ${railLabelClasses}`}>Reported</span>
      <span className="text-sm text-indigo-200/90">
        {item.reporter?.name ?? "Former user"} · {formatShortDateTime(item.createdAt)}
      </span>
      {item.resolvedAt && (
        <span className="text-sm text-indigo-200/90">Resolved {formatShortDateTime(item.resolvedAt)}</span>
      )}
    </div>
  );
};
