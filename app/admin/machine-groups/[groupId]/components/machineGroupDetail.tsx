"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SavedToast } from "@/components/ui/savedToast";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getMachineGroupRequest } from "@/lib/api/adminMachineGroupsApi";
import { MachineGroupFormModal } from "../../components/machineGroupFormModal";
import { DeleteMachineGroupDialog } from "../../components/deleteMachineGroupDialog";
import { GroupDetailTabs, type GroupDetailTab } from "./groupDetailTabs";
import { GroupMachinesTab } from "./groupMachinesTab";
import { GroupAssignmentsTab } from "./groupAssignmentsTab";
import { GroupActivityTab } from "./groupActivityTab";

// One global group: its machines (any organisation), who it's shared with
// and what changed. Counts in the header refresh after each change.
export const MachineGroupDetail = ({ groupId }: { groupId: string }) => {
  const router = useRouter();
  const panelId = useId();
  const group = useApiResource(
    (token) => getMachineGroupRequest(token, groupId),
    [groupId],
    "Couldn't load this group.",
  );
  const [tab, setTab] = useState<GroupDetailTab>("machines");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const reloadGroup = group.reload;
  const notify = useCallback(
    (message: string) => {
      setToast(message);
      reloadGroup();
    },
    [reloadGroup],
  );

  if (group.error) return <LoadErrorState message={group.error} onRetry={group.reload} />;
  if (!group.data) return <SkeletonBar className="h-24 w-full" />;
  const current = group.data;

  return (
    <>
      <Link href="/admin/machine-groups" className="flex w-fit items-center gap-1 text-sm text-bodyGray hover:text-ink">
        <Icon name="chevl" className="h-4 w-4" />
        Machine groups
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <MachineGroupBadge name={current.name} colour={current.colour} className="w-fit text-base" />
          {current.description && <p className="text-sm text-bodyGray">{current.description}</p>}
          <span className="text-xs text-mutedGray">
            {current.machineCount} machines · {current.organisationCount} organisations · {current.userCount} users
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setIsEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={() => setIsDeleting(true)}>
            Delete
          </Button>
        </div>
      </div>
      <GroupDetailTabs value={tab} panelId={panelId} onChange={setTab} />
      <section id={panelId} role="tabpanel" className="flex min-w-0 flex-col gap-3">
        {tab === "machines" && <GroupMachinesTab groupId={groupId} onChanged={notify} />}
        {tab === "assignments" && <GroupAssignmentsTab groupId={groupId} onChanged={notify} />}
        {tab === "activity" && <GroupActivityTab groupId={groupId} />}
      </section>
      {isEditing && (
        <MachineGroupFormModal
          group={current}
          onSaved={(saved) => {
            setIsEditing(false);
            notify(`${saved.name} saved.`);
          }}
          onClose={() => setIsEditing(false)}
        />
      )}
      {isDeleting && (
        <DeleteMachineGroupDialog
          group={current}
          onDeleted={() => router.push("/admin/machine-groups")}
          onClose={() => setIsDeleting(false)}
        />
      )}
      {toast && <SavedToast message={toast} onDismiss={dismissToast} />}
    </>
  );
};
