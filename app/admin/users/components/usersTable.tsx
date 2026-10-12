import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { ActionMenu } from "@/components/ui/actionMenu";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import { formatLastActiveLabel } from "@/lib/format/lastActiveLabel";
import { adminUserStatusLabel, adminUserStatusTone, type AdminUser } from "@/lib/types/adminUser";

interface UsersTableProps {
  users: AdminUser[];
  isLoading: boolean;
  errorMessage: string | null;
  // The signed-in admin: no row menu on their own row (they can't change
  // their own role or remove themselves).
  currentUserId: string | null;
  onChangeRole: (user: AdminUser) => void;
  onRemove: (user: AdminUser) => void;
}

const TableMessage = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-center gap-2 p-10 text-sm text-mutedGray">{children}</div>
);

export const UsersTable = ({ users, isLoading, errorMessage, currentUserId, onChangeRole, onRemove }: UsersTableProps) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3}>Name</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Role</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Organisation</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Last active</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Status</TableHeaderCell>
        <TableHeaderCell flex={0.3}>{""}</TableHeaderCell>
      </TableHeaderRow>
      {errorMessage && <TableMessage><span className="text-danger">{errorMessage}</span></TableMessage>}
      {!errorMessage && isLoading && users.length === 0 && (
        <TableMessage><LoadingSpinner /> Loading users…</TableMessage>
      )}
      {!errorMessage && !isLoading && users.length === 0 && <TableMessage>No users found.</TableMessage>}
      {!errorMessage &&
        users.map((user) => {
          const fullName = `${user.firstName} ${user.lastName}`.trim();
          return (
            <TableRow key={user.id}>
              <TableCell flex={3} className="flex items-center gap-2.5">
                <Avatar initials={getInitials(fullName)} imageSrc={user.avatarUrl ?? undefined} size="sm" />
                <div className="flex flex-col">
                  <span className="font-medium">{fullName}</span>
                  <span className="text-xs text-mutedGray">{user.email}</span>
                </div>
              </TableCell>
              <TableCell flex={0.8} className="flex flex-wrap gap-1">
                {user.roles.length ? (
                  user.roles.map((role) => <Tag key={role}>{role}</Tag>)
                ) : (
                  <span className="text-xs text-mutedGray">No role</span>
                )}
              </TableCell>
              <TableCell flex={0.8} className="text-bodyGray">{user.organisation.name}</TableCell>
              <TableCell flex={0.8} className="text-xs text-mutedGray">{formatLastActiveLabel(user)}</TableCell>
              <TableCell flex={0.7}>
                <Tag tone={adminUserStatusTone[user.status]}>{adminUserStatusLabel[user.status]}</Tag>
              </TableCell>
              <TableCell flex={0.3} className="flex justify-end">
                {user.id !== currentUserId && (
                  <ActionMenu
                    label={fullName}
                    items={[
                      { label: "Change role", icon: "shield", onSelect: () => onChangeRole(user) },
                      { label: "Remove user", icon: "x", tone: "danger", onSelect: () => onRemove(user) },
                    ]}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
    </Table>
  );
};
