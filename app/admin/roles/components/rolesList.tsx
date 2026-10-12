import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { AdminRole } from "@/lib/types/adminRole";

interface RolesListProps {
  roles: AdminRole[];
  selectedRoleId: string | null;
  totalPermissions: number;
  onSelect: (roleId: string) => void;
}

const describeRole = (role: AdminRole, totalPermissions: number): string => {
  const users = `${role.userCount} ${role.userCount === 1 ? "user" : "users"}`;
  const granted = role.permissionCodes.length;
  const permissions =
    totalPermissions > 0 && granted >= totalPermissions
      ? "all permissions"
      : `${granted} of ${totalPermissions} permissions`;
  return `${users} · ${permissions}`;
};

export const RolesList = ({ roles, selectedRoleId, totalPermissions, onSelect }: RolesListProps) => {
  return (
    <div className="flex w-72 max-w-xs flex-none flex-col gap-2.5 overflow-y-auto">
      {roles.map((role) => {
        const selected = role.id === selectedRoleId;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left ${
              selected ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surface"
            }`}
          >
            <div className="flex items-center">
              <span className={`text-[15px] text-ink ${selected ? "font-medium" : ""}`}>{role.name}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {role.organisation ? (
                  <Tag>{role.organisation.name}</Tag>
                ) : role.isBuiltIn ? (
                  <Tag tone="primary">Default</Tag>
                ) : (
                  <Tag>Custom</Tag>
                )}
                <Icon name="chevr" className={selected ? "stroke-primary" : "stroke-mutedGray"} />
              </span>
            </div>
            <span className="text-xs text-mutedGray">{describeRole(role, totalPermissions)}</span>
          </button>
        );
      })}
    </div>
  );
};
