"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { assignGroupRequest, listGroupMachinesRequest } from "@/lib/api/adminMachineGroupsApi";
import type { AssignmentTargetType, ShareAccessLevel } from "@/lib/types/machineGroup";
import { AssignTargetPicker, type AssignTarget } from "./assignTargetPicker";

interface AssignGroupModalProps {
  groupId: string;
  onAssigned: (targetName: string) => void;
  onClose: () => void;
}

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const TARGET_TYPES: { value: AssignmentTargetType; label: string }[] = [
  { value: "organisation", label: "Organisation" },
  { value: "user", label: "User" },
];
const LEVELS: { value: ShareAccessLevel; label: string; hint: string }[] = [
  { value: "view", label: "View", hint: "Read only" },
  { value: "contribute", label: "Contribute", hint: "Can also add history, photos and cases" },
];

// Shares the group with an organisation (everyone in it) or one person.
// Assigning someone who already has it changes their level.
export const AssignGroupModal = ({ groupId, onAssigned, onClose }: AssignGroupModalProps) => {
  const [targetType, setTargetType] = useState<AssignmentTargetType>("organisation");
  const [target, setTarget] = useState<AssignTarget | null>(null);
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("view");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const machines = useApiResource((token) => listGroupMachinesRequest(token, groupId), [groupId], "");
  const owners = Array.from(new Set((machines.data ?? []).map((machine) => machine.owningOrganisation.name)));

  const handleAssign = async () => {
    if (!target) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await assignGroupRequest(requireAccessToken(), groupId, { targetType, targetId: target.id, accessLevel });
      onAssigned(target.name);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't share the group. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Assign group" onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3.5 p-5">
        <fieldset className="flex gap-4" disabled={isSaving}>
          <legend className={`mb-1.5 ${fieldLabelClasses}`}>Share with</legend>
          {TARGET_TYPES.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="targetType"
                className="accent-primary"
                checked={targetType === option.value}
                onChange={() => {
                  setTargetType(option.value);
                  setTarget(null);
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <AssignTargetPicker targetType={targetType} selectedId={target?.id ?? null} onSelect={setTarget} />
        <fieldset className="flex flex-col gap-1.5" disabled={isSaving}>
          <legend className={`mb-1.5 ${fieldLabelClasses}`}>Access</legend>
          {LEVELS.map((level) => (
            <label key={level.value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="accessLevel"
                className="accent-primary"
                checked={accessLevel === level.value}
                onChange={() => setAccessLevel(level.value)}
              />
              {level.label}
              <span className="text-xs text-mutedGray">{level.hint}</span>
            </label>
          ))}
        </fieldset>
        {target && (
          <div
            role="note"
            className="flex gap-2 rounded-lg border border-amberBorder bg-amberTint px-3 py-2 text-sm text-amber"
          >
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              {targetType === "organisation" ? `Users in ${target.name}` : target.name} will be able to see these
              machines, their history and cases. Owning organisations: {owners.length ? owners.join(", ") : "none yet"}.
            </span>
          </div>
        )}
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleAssign} disabled={!target || isSaving}>
            {isSaving ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
