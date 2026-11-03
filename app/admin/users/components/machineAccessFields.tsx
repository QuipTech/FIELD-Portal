import Link from "next/link";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { ShareAccessLevelTag } from "@/components/machines/shareAccessLevelTag";
import type { AccessibleGroup, MachineAccessMode } from "@/lib/types/machineGroup";

interface MachineAccessFieldsProps {
  mode: MachineAccessMode;
  onChange: (mode: MachineAccessMode) => void;
  // Admin roles always see their organisation's machines; the choice is hidden.
  isAdminRole: boolean;
  // Shared groups they already have (directly or through their organisation).
  groups?: AccessibleGroup[];
  disabled?: boolean;
}

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";
const MODES: { value: MachineAccessMode; label: string; hint: string }[] = [
  {
    value: "all",
    label: "Own organisation and shared groups",
    hint: "Their organisation's machines, plus any shared with them",
  },
  {
    value: "groups_only",
    label: "Only shared groups",
    hint: "Only machines in groups assigned to them or their organisation",
  },
];

// "Machine access" in Invite user and Edit machine access. Groups are
// assigned on Admin view → Machine groups; listed here read-only.
export const MachineAccessFields = ({ mode, onChange, isAdminRole, groups, disabled }: MachineAccessFieldsProps) => (
  <fieldset className="flex flex-col gap-2" disabled={disabled}>
    <legend className={`mb-1.5 ${fieldLabelClasses}`}>Machine access</legend>
    {isAdminRole ? (
      <p className="text-sm text-bodyGray">
        Admins always see their organisation&apos;s machines, plus any shared with them.
      </p>
    ) : (
      MODES.map((option) => (
        <label key={option.value} className="flex items-start gap-2 text-sm text-ink">
          <input
            type="radio"
            name="machineAccessMode"
            checked={mode === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1 accent-primary"
          />
          <span className="flex flex-col">
            {option.label}
            <span className="text-xs text-mutedGray">{option.hint}</span>
          </span>
        </label>
      ))
    )}
    {groups && (
      <div className="flex flex-col gap-1.5 rounded-lg border border-borderGray p-2.5">
        <span className={fieldLabelClasses}>Shared groups</span>
        {groups.length === 0 ? (
          <span className="text-sm text-mutedGray">None yet.</span>
        ) : (
          groups.map((group) => (
            <Link
              key={group.id}
              href={`/admin/machine-groups/${group.id}`}
              className="flex items-center gap-2 hover:underline"
            >
              <MachineGroupBadge name={group.name} colour={group.colour} />
              <ShareAccessLevelTag level={group.accessLevel} />
            </Link>
          ))
        )}
        <Link href="/admin/machine-groups" className="text-xs text-primary hover:underline">
          Manage on Machine groups
        </Link>
      </div>
    )}
    {!isAdminRole && mode === "groups_only" && groups?.length === 0 && (
      <span className="text-xs text-mutedGray">They&apos;ll see no machines until a group is assigned to them.</span>
    )}
  </fieldset>
);
