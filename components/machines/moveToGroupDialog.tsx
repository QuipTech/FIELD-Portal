"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { Modal } from "@/components/ui/modal";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listMachineGroupsRequest, moveMachinesToGroupRequest } from "@/lib/api/adminMachineGroupsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { useApiResource } from "@/lib/hooks/useApiResource";

interface MoveToGroupDialogProps {
  machines: { id: string; label: string }[];
  // The message to show once they've moved.
  onMoved: (message: string) => void;
  onClose: () => void;
}

const describeMachines = (machines: { label: string }[]) =>
  machines.length === 1 ? machines[0].label : `${machines.length} machines`;

// Platform administrator only: moves machines into one group, taking them out
// of every group they're in now. To add a machine to a group as well, use
// Manage groups on the machine.
export const MoveToGroupDialog = ({ machines, onMoved, onClose }: MoveToGroupDialogProps) => {
  const groups = useApiResource(listMachineGroupsRequest, [], "Couldn't load the groups.");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subject = describeMachines(machines);

  const move = async () => {
    if (!targetId) return;
    setIsMoving(true);
    setError(null);
    try {
      const result = await moveMachinesToGroupRequest(
        requireAccessToken(),
        machines.map((machine) => machine.id),
        targetId,
      );
      onMoved(
        result.moved === 0
          ? `${subject} ${machines.length === 1 ? "was" : "were"} already only in ${result.group.name}.`
          : `${result.moved === machines.length ? subject : `${result.moved} of ${machines.length} machines`} moved to ${result.group.name}.`,
      );
      onClose();
    } catch (moveError) {
      setError(toApiErrorMessage(moveError, "Couldn't move the machines. Please try again."));
      setIsMoving(false);
    }
  };

  const renderGroups = () => {
    if (groups.error) return <LoadErrorState message={groups.error} onRetry={groups.reload} />;
    if (!groups.data) return <SkeletonBar className="h-40 w-full rounded-lg" />;
    if (groups.data.length === 0) {
      return <p className="text-sm text-mutedGray">There are no groups yet. Create one in Admin → Machine groups.</p>;
    }
    const query = search.trim().toLowerCase();
    const shown = groups.data.filter((group) => group.name.toLowerCase().includes(query));
    return (
      <>
        <Input icon="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups" aria-label="Search groups" />
        <div role="radiogroup" aria-label="Group to move to" className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-borderGray">
          {shown.length === 0 && <p className="p-4 text-sm text-mutedGray">No groups match.</p>}
          {shown.map((group) => (
            <label key={group.id} className="flex items-center gap-3 border-b border-borderGray px-3 py-2.5 text-sm last:border-b-0">
              <input
                type="radio"
                name="target-group"
                aria-label={group.name}
                className="h-4 w-4 accent-primary"
                checked={targetId === group.id}
                disabled={isMoving}
                onChange={() => setTargetId(group.id)}
              />
              <MachineGroupBadge name={group.name} colour={group.colour} className="w-fit" />
              <span className="ml-auto text-xs text-mutedGray">
                {group.machineCount} machine{group.machineCount === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </>
    );
  };

  return (
    <Modal title={`Move ${subject} to a group`} onClose={isMoving ? undefined : onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-bodyGray">
          {machines.length === 1 ? "It leaves" : "They leave"} every group {machines.length === 1 ? "it's" : "they're"} in now and join the one you pick. Groups control who can see a machine; to record where it is, change its Site.
        </p>
        {renderGroups()}
        {targetId && (
          <p role="alert" className="text-xs text-danger">
            Everyone the current groups are shared with stops seeing {machines.length === 1 ? "it" : "them"} on their next page load, unless the new group also shares {machines.length === 1 ? "it" : "them"} with them.
          </p>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={move} disabled={isMoving || !targetId}>
            {isMoving ? "Moving…" : `Move ${subject}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
