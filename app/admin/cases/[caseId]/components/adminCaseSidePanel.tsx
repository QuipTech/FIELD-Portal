"use client";

import { Avatar } from "@/components/ui/avatar";
import { SlaTimeLeft } from "@/components/supportCases/slaTimeLeft";
import { CASE_PRIORITIES, CASE_STATUS_LABELS } from "@/lib/format/caseLabels";
import { abbreviateName, getInitials } from "@/lib/format/nameInitials";
import type { AdminSupportCase } from "@/lib/types/adminSupportCase";
import type { CasePriority, CaseStatus, SupportCaseChanges } from "@/lib/types/supportCase";
import { isAdminViewer, selectableStatuses } from "../staffCaseRules";
import { AssigneePicker } from "./assigneePicker";
import { PanelField, PanelRow, PanelSection, panelSelectClasses } from "./panelSection";

interface AdminCaseSidePanelProps {
  item: AdminSupportCase;
  currentUserId: string | null;
  isSaving: boolean;
  onChange: (changes: SupportCaseChanges) => void;
}

const STATUS_FLOW = "New · Open · Waiting on customer · Resolved · Closed";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// A13b's right panel: customer, handling, linked. Only the admin assigns
// or changes priority; the assignee may change the status.
export const AdminCaseSidePanel = ({ item, currentUserId, isSaving, onChange }: AdminCaseSidePanelProps) => {
  const isAdmin = isAdminViewer(item);
  const statuses = selectableStatuses(item);
  const statusOptions = statuses.includes(item.status) ? statuses : [item.status, ...statuses];
  const reporterName = item.reporter?.name ?? "Former user";

  return (
    <aside className="flex w-[340px] flex-none flex-col overflow-y-auto rounded-tl-[18px] bg-gradient-to-b from-brandDeep to-[#221C52]">
      <PanelSection title="Customer">
        <div className="flex items-center gap-3">
          <Avatar initials={getInitials(reporterName)} imageSrc={item.reporter?.avatarUrl ?? undefined} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[17px] font-medium text-white">{abbreviateName(reporterName)}</span>
            {item.reporterEmail && <span className="truncate text-sm text-indigo-200/60">{item.reporterEmail}</span>}
          </div>
        </div>
        <PanelRow label="Company">{item.company.name}</PanelRow>
        <PanelRow label="Plan">
          <span className="rounded-md bg-white px-2.5 py-1 text-sm text-brandDeep">
            {item.company.plan ? capitalize(item.company.plan) : "None"}
          </span>
        </PanelRow>
      </PanelSection>
      <PanelSection title="Handling">
        <PanelField label="Assignee">
          {isAdmin ? (
            <AssigneePicker
              assignee={item.assignee}
              currentUserId={currentUserId}
              isBusy={isSaving}
              onAssign={(assigneeId) => onChange({ assigneeId })}
            />
          ) : (
            <span className="text-[15px] text-white">{item.assignee?.name ?? "Unassigned"}</span>
          )}
        </PanelField>
        <PanelField label="Status" hint={STATUS_FLOW}>
          <select
            aria-label="Status"
            className={panelSelectClasses}
            value={item.status}
            disabled={isSaving}
            onChange={(event) => onChange({ status: event.target.value as CaseStatus })}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status} disabled={!statuses.includes(status)}>
                {CASE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </PanelField>
        <PanelField label="Priority">
          <select
            aria-label="Priority"
            className={panelSelectClasses}
            value={item.priority}
            disabled={isSaving || !isAdmin}
            onChange={(event) => onChange({ priority: event.target.value as CasePriority })}
          >
            {CASE_PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </PanelField>
        <PanelRow label="SLA response due">
          <SlaTimeLeft slaDueAt={item.slaDueAt} slaPausedAt={item.slaPausedAt} status={item.status} variant="badge" />
        </PanelRow>
      </PanelSection>
      <PanelSection title="Linked">
        <span className="text-[15px] text-white">
          {item.machine ? [item.machine.label, item.machine.modelName].filter(Boolean).join(" · ") : "No machine linked"}
        </span>
      </PanelSection>
    </aside>
  );
};
