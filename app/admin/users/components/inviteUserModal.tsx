"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/selectInput";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { inviteUserRequest } from "@/lib/api/adminUsersApi";
import type { AdminRole } from "@/lib/types/adminRole";
import type { AdminOrganisation } from "@/lib/types/adminUser";
import { assignableRoles, describeRoleOption } from "../assignableRoles";

interface InviteUserModalProps {
  roles: AdminRole[];
  // The Owner picks which organisation the person joins.
  organisations: AdminOrganisation[];
  defaultOrganisationId: string;
  onInvited: (email: string) => void;
  onClose: () => void;
}

const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";


export const InviteUserModal = ({ roles, organisations, defaultOrganisationId, onInvited, onClose }: InviteUserModalProps) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organisationId, setOrganisationId] = useState(defaultOrganisationId);
  const [roleId, setRoleId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const roleOptions = assignableRoles(roles, organisationId);
  const canSend = email.includes("@") && firstName.trim() && lastName.trim() && roleId && !isSending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setIsSending(true);
    setSendError(null);
    try {
      await inviteUserRequest(requireAccessToken(), {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roleId,
        organisationId: organisations.length > 1 ? organisationId : undefined,
      });
      onInvited(email.trim());
    } catch (error) {
      setSendError(toApiErrorMessage(error, "Couldn't send the invitation. Please try again."));
      setIsSending(false);
    }
  };

  return (
    <Modal title="Invite user" onClose={isSending ? undefined : onClose} widthClassName="w-[520px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Email</span>
          <Input type="email" icon="user" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required autoFocus />
        </label>
        <div className="flex gap-2.5">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={fieldLabelClasses}>First name</span>
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={fieldLabelClasses}>Last name</span>
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required />
          </label>
        </div>
        {organisations.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClasses}>Organisation</span>
            <SelectInput
              value={organisationId}
              onChange={(event) => {
                setOrganisationId(event.target.value);
                setRoleId("");
              }}
             
            >
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </SelectInput>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Role</span>
          <SelectInput value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
            <option value="">Choose a role</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {describeRoleOption(role)}
              </option>
            ))}
          </SelectInput>
        </label>
        <span className="text-xs text-mutedGray">
          They&apos;ll get an email with a temporary password and choose their own when they first sign in.
        </span>
        {sendError && <span className="text-xs text-danger">{sendError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!canSend}>
            <Icon name="send" />
            {isSending ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
