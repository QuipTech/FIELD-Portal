"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { Modal } from "@/components/ui/modal";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  getMachineGroupsRequest,
  listMachineGroupsRequest,
  setMachineGroupsRequest,
} from "@/lib/api/adminMachineGroupsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { useApiResource } from "@/lib/hooks/useApiResource";

interface ManageMachineGroupsModalProps {
  machine: { id: string; label: string };
  onSaved: (message: string) => void;
  onClose: () => void;
}

const namesOf = (groups: { name: string }[]) => groups.map((group) => group.name).join(", ");

// Platform administrator only: which groups one machine is in. Ticking and
// unticking together moves it between groups in one transaction. Groups decide
// who can see a machine; where it is located is its Site.
export const ManageMachineGroupsModal = ({ machine, onSaved, onClose }: ManageMachineGroupsModalProps) => {
  const resource = useApiResource(
    async (token) => {
      const [groups, current] = await Promise.all([listMachineGroupsRequest(token), getMachineGroupsRequest(token, machine.id)]);
      return { groups, currentIds: current.map((group) => group.id) };
    },
    [machine.id],
    "Couldn't load the machine's groups.",
  );
  // null until the first change: the machine's current groups apply.
  const [edited, setEdited] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderBody = () => {
    if (resource.error) return <LoadErrorState message={resource.error} onRetry={resource.reload} />;
    if (!resource.data) return <SkeletonBar className="h-40 w-full rounded-lg" />;

    const { groups, currentIds } = resource.data;
    const selected = edited ?? currentIds;
    const added = groups.filter((group) => selected.includes(group.id) && !currentIds.includes(group.id));
    const removed = groups.filter((group) => currentIds.includes(group.id) && !selected.includes(group.id));
    const hasChanges = added.length > 0 || removed.length > 0;
    const query = search.trim().toLowerCase();
    const shown = groups.filter((group) => group.name.toLowerCase().includes(query));

    const toggle = (groupId: string) =>
      setEdited(selected.includes(groupId) ? selected.filter((id) => id !== groupId) : [...selected, groupId]);

    const save = async () => {
      setIsSaving(true);
      setError(null);
      try {
        await setMachineGroupsRequest(requireAccessToken(), machine.id, selected);
        onSaved(`Groups updated for ${machine.label}.`);
        onClose();
      } catch (saveError) {
        setError(toApiErrorMessage(saveError, "Couldn't update the groups. Please try again."));
        setIsSaving(false);
      }
    };

    return (
      <>
        <Input icon="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups" aria-label="Search groups" />
        <div className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-borderGray">
          {shown.length === 0 && <p className="p-4 text-sm text-mutedGray">No groups match.</p>}
          {shown.map((group) => (
            <label key={group.id} className="flex items-center gap-3 border-b border-borderGray px-3 py-2.5 text-sm last:border-b-0">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={selected.includes(group.id)}
                disabled={isSaving}
                onChange={() => toggle(group.id)}
              />
              <MachineGroupBadge name={group.name} colour={group.colour} className="w-fit" />
            </label>
          ))}
        </div>
        {added.length > 0 && <p className="text-sm text-bodyGray">Adding to: {namesOf(added)}</p>}
        {removed.length > 0 && <p className="text-sm text-bodyGray">Removing from: {namesOf(removed)}</p>}
        {removed.length > 0 && (
          <p role="alert" className="text-xs text-danger">
            Everyone these groups are shared with stops seeing {machine.label} on their next page load, unless another group still shares it with them.
          </p>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={save} disabled={isSaving || !hasChanges}>
            {isSaving ? "Saving…" : "Save groups"}
          </Button>
        </div>
      </>
    );
  };

  return (
    <Modal title={`Manage groups: ${machine.label}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-bodyGray">Groups control who can see this machine. To record where it is, change its Site.</p>
        {renderBody()}
      </div>
    </Modal>
  );
};
