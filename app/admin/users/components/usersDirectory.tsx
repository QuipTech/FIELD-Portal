"use client";

import { useCallback, useId, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SavedToast } from "@/components/ui/savedToast";
import { usePageReset } from "@/lib/hooks/usePageReset";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { listAdminRolesRequest } from "@/lib/api/adminRolesApi";
import { listAdminOrganisationsRequest } from "@/lib/api/adminUsersApi";
import { RoleFilterTabs } from "./roleFilterTabs";
import { UsersTable } from "./usersTable";
import { InviteUserModal } from "./inviteUserModal";
import { ChangeRoleModal } from "./changeRoleModal";
import { RemoveUserDialog } from "./removeUserDialog";
import { EditMachineAccessModal } from "./editMachineAccessModal";
import type { AdminUser } from "@/lib/types/adminUser";
import type { AdminRole } from "@/lib/types/adminRole";
import { USERS_PAGE_SIZE, useAdminUsers } from "../useAdminUsers";
import { assignableRoles, isMachineAccessAdminRole } from "../assignableRoles";

// Role names, once each: the Owner can see same-named roles in
// several organisations. Tabs filter the loaded directory by role name.
const toUniqueRoleNames = (names: string[]) => Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

// Admins always see their organisation's machines, so their mode is fixed.
const hasAdminRole = (user: AdminUser, roles: AdminRole[]) =>
  assignableRoles(roles, user.organisation.id).some(
    (role) => user.roles.includes(role.name) && isMachineAccessAdminRole(role),
  );

export const UsersDirectory = () => {
  const panelId = useId();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [accessTarget, setAccessTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [page, setPage] = usePageReset([search, role]);
  const { users, total, isLoading, errorMessage, reload } = useAdminUsers(search.trim(), role, page);
  const roles = useApiResource(listAdminRolesRequest, [], "Couldn't load roles.");
  const organisations = useApiResource(listAdminOrganisationsRequest, [], "Couldn't load organisations.");
  const profile = useSignedInProfile();
  const organisationList = organisations.data ?? [];
  const roleNames = toUniqueRoleNames((roles.data ?? []).map((item) => item.name));

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-[22px] font-medium text-ink">Users</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" onClick={() => setIsInviteOpen(true)} disabled={!roles.data || !organisations.data}>
            <Icon name="plus" />
            Invite user
          </Button>
        </div>
      </div>
      {notice && (
        <div className="flex items-center gap-2 rounded-lg bg-primaryTint px-3 py-2 text-sm text-primaryTintText">
          <Icon name="check" className="h-4 w-4" />
          {notice}
          <button type="button" className="ml-auto" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}
      <RoleFilterTabs
        panelId={panelId}
        value={role}
        roleNames={roleNames}
        onChange={(nextRole) => {
          setPage(1);
          setRole(nextRole);
        }}
      />
      <div
        id={panelId}
        role="tabpanel"
        aria-busy={isLoading}
        aria-labelledby={`${panelId}-tab-${role ? roleNames.indexOf(role) + 1 : 0}`}
        className="flex min-w-0 flex-col gap-3.5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Input
            icon="search"
            placeholder="Search users"
            className="w-60"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          {!errorMessage && !isLoading && (
            <span className="ml-auto text-xs text-slate-400">
              {total} {total === 1 ? "user" : "users"}
            </span>
          )}
        </div>
        <UsersTable
          users={users}
          isLoading={isLoading}
          errorMessage={errorMessage}
          currentUserId={profile?.user.id ?? null}
          onChangeRole={setRoleTarget}
          canEditMachineAccess={(user) => Boolean(user.machineAccess)}
          onEditMachineAccess={setAccessTarget}
          onRemove={setRemoveTarget}
        />
        {!errorMessage && !isLoading && (
          <Pagination page={page} pageSize={USERS_PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </div>
      {isInviteOpen && roles.data && (
        <InviteUserModal
          roles={roles.data}
          organisations={organisationList}
          defaultOrganisationId={profile?.tenant?.id || organisationList[0]?.id || ""}
          onInvited={(email) => {
            setIsInviteOpen(false);
            setNotice(`Invitation sent to ${email}. They'll appear as Invited until they first sign in.`);
            reload();
          }}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
      {removeTarget && (
        <RemoveUserDialog
          user={removeTarget}
          onRemoved={() => {
            setNotice(`${removeTarget.firstName} ${removeTarget.lastName} was removed.`);
            reload();
          }}
          onClose={() => setRemoveTarget(null)}
        />
      )}
      {accessTarget && (
        <EditMachineAccessModal
          user={accessTarget}
          isAdminRole={hasAdminRole(accessTarget, roles.data ?? [])}
          onSaved={() => {
            setToast(`Machine access updated for ${accessTarget.firstName} ${accessTarget.lastName}.`);
            setAccessTarget(null);
            reload();
          }}
          onClose={() => setAccessTarget(null)}
        />
      )}
      {toast && <SavedToast message={toast} onDismiss={dismissToast} />}
      {roleTarget && roles.data && (
        <ChangeRoleModal
          user={roleTarget}
          roles={roles.data}
          onChanged={() => {
            setNotice(`Role updated for ${roleTarget.firstName} ${roleTarget.lastName}.`);
            setRoleTarget(null);
            reload();
          }}
          onClose={() => setRoleTarget(null)}
        />
      )}
    </>
  );
};
