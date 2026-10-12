"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { listAdminRolesRequest } from "@/lib/api/adminRolesApi";
import { listAdminOrganisationsRequest } from "@/lib/api/adminUsersApi";
import { FilterSelect } from "./filterSelect";
import { UsersTable } from "./usersTable";
import { InviteUserModal } from "./inviteUserModal";
import { ChangeRoleModal } from "./changeRoleModal";
import { RemoveUserDialog } from "./removeUserDialog";
import type { AdminUser } from "@/lib/types/adminUser";
import { useAdminUsers } from "../useAdminUsers";

// Role names, once each: the Owner can see same-named roles in
// several organisations, and the backend filters by name.
const toRoleNameOptions = (names: string[]) =>
  Array.from(new Set(names))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));

export const UsersDirectory = () => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const { users, total, isLoading, errorMessage, reload } = useAdminUsers({ search: search.trim(), role });
  const roles = useApiResource(listAdminRolesRequest, [], "Couldn't load roles.");
  const organisations = useApiResource(listAdminOrganisationsRequest, [], "Couldn't load organisations.");
  const profile = useSignedInProfile();
  const organisationList = organisations.data ?? [];

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-[22px] font-medium text-ink">Users</h1>
        <Button variant="primary" className="ml-auto" onClick={() => setIsInviteOpen(true)} disabled={!roles.data || !organisations.data}>
          <Icon name="plus" />
          Invite user
        </Button>
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
      <div className="flex items-center gap-3">
        <Input icon="search" placeholder="Search users" className="w-60" value={search} onChange={(event) => setSearch(event.target.value)} />
        <FilterSelect label="Role" value={role} options={toRoleNameOptions((roles.data ?? []).map((item) => item.name))} onChange={setRole} />
        {!errorMessage && (
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
        onRemove={setRemoveTarget}
      />
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
