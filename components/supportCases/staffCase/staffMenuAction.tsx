import { Icon, type IconName } from "@/components/icons/icon";

interface StaffMenuActionProps {
  icon: IconName;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

// "Assign to me" / "Unassign" at the foot of the assign dropdown (A13c).
export const StaffMenuAction = ({ icon, label, disabled, onClick }: StaffMenuActionProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] text-bodyGray hover:bg-fillGray disabled:opacity-40 disabled:hover:bg-transparent"
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fillGray">
      <Icon name={icon} className="h-4 w-4" />
    </span>
    {label}
  </button>
);
