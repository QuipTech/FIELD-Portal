import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { adminUsers } from "@/lib/mockData/adminUsers";
import { adminUserStatusTone } from "@/lib/types/adminUser";

export const UsersTable = () => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3}>Name</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Role</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Site</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Last active</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Status</TableHeaderCell>
      </TableHeaderRow>
      {adminUsers.map((user) => (
        <TableRow key={user.id}>
          <TableCell flex={3} className="flex items-center gap-2.5">
            <Avatar initials={user.initials} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-mutedGray">{user.email}</span>
            </div>
          </TableCell>
          <TableCell flex={0.8}><Tag>{user.role}</Tag></TableCell>
          <TableCell flex={0.8} className="text-bodyGray">{user.site}</TableCell>
          <TableCell flex={0.8} className="text-xs text-mutedGray">{user.lastActiveLabel}</TableCell>
          <TableCell flex={0.7}>
            <Tag tone={adminUserStatusTone[user.status]}>{user.status}</Tag>
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
