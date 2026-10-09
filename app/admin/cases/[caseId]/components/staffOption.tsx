import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { abbreviateName, getInitials } from "@/lib/format/nameInitials";
import type { SupportStaffMember } from "@/lib/types/adminSupportCase";

interface StaffOptionProps {
  member: SupportStaffMember;
  isSelected: boolean;
  onSelect: () => void;
}

const describeMember = (member: SupportStaffMember) =>
  member.isSupportStaff
    ? `${member.isAdmin ? "Admin" : "Support agent"} · ${member.openCaseCount} open`
    : `${member.organisationName} · customer`;

// One person in the assign dropdown: "T. Meyer — Admin · 3 open".
// Customers are listed but can't be picked.
export const StaffOption = ({ member, isSelected, onSelect }: StaffOptionProps) => (
  <button
    type="button"
    role="option"
    aria-selected={isSelected}
    aria-disabled={!member.isSupportStaff}
    disabled={!member.isSupportStaff}
    onClick={onSelect}
    title={member.isSupportStaff ? undefined : "Customers can't be assigned cases. QuipTech's team and Support Agents can."}
    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
      isSelected ? "bg-primaryTint" : "enabled:hover:bg-fillGray"
    }`}
  >
    <Avatar initials={getInitials(member.name)} imageSrc={member.avatarUrl ?? undefined} size="md" />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-[15px] font-medium text-ink">{abbreviateName(member.name)}</span>
      <span className="truncate text-sm text-mutedGray">{describeMember(member)}</span>
    </span>
    {isSelected && <Icon name="check" className="h-4 w-4 stroke-primary" />}
  </button>
);
