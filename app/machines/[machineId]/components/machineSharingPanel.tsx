"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { Tag } from "@/components/ui/tag";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { ShareAccessLevelTag } from "@/components/machines/shareAccessLevelTag";
import { ReasonConfirmDialog } from "@/components/machines/reasonConfirmDialog";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { listMachineSharesRequest, withdrawMachineShareRequest } from "@/lib/api/machineSharesApi";
import type { MachineShare } from "@/lib/types/machineGroup";
import { useMachineDetail } from "../machineDetailContext";

// Machine detail → Sharing, for the owning organisation's admins: who
// outside the organisation can see this machine through QuipTech's machine
// groups, and withdrawing it from one share (the platform administrator is
// told). Nothing shows to anyone else.
export const MachineSharingPanel = ({ machineId }: { machineId: string }) => {
  const { isLoaded, can } = usePermissions();
  const canManage = isLoaded && can(PERMISSIONS.manageUsers);
  return canManage ? <SharingList machineId={machineId} /> : null;
};

const SharingList = ({ machineId }: { machineId: string }) => {
  const { notify } = useMachineDetail();
  const shares = useApiResource((token) => listMachineSharesRequest(token, machineId), [machineId], "");
  const [withdrawing, setWithdrawing] = useState<MachineShare | null>(null);

  if (!shares.data) return shares.isLoading ? <SkeletonBar className="h-14 w-full rounded-xl" /> : null;
  if (shares.data.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-borderGray bg-surface p-4">
      <div className="flex flex-col">
        <h2 className="text-[15px] font-medium text-ink">Sharing</h2>
        <p className="text-xs text-mutedGray">Who outside your organisation can see this machine, its history and cases.</p>
      </div>
      <ul className="flex flex-col divide-y divide-borderGray">
        {shares.data.map((share) => (
          <li key={share.assignmentId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <MachineGroupBadge name={share.group.name} colour={share.group.colour} />
            <span className="min-w-0 flex-1 truncate text-ink">
              {share.targetName}
              {share.targetType === "user" && <span className="text-mutedGray"> · {share.organisationName}</span>}
            </span>
            {share.withdrawnAt ? (
              <Tag>Withdrawn</Tag>
            ) : (
              <>
                <ShareAccessLevelTag level={share.accessLevel} />
                <Button size="sm" variant="ghost" onClick={() => setWithdrawing(share)}>
                  Revoke
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {withdrawing && (
        <ReasonConfirmDialog
          title={`Stop sharing with ${withdrawing.targetName}?`}
          confirmLabel="Revoke"
          failedMessage="Couldn't revoke the share. Please try again."
          onConfirm={async (reason) => {
            shares.setData(
              await withdrawMachineShareRequest(
                requireAccessToken(),
                { machineId, assignmentId: withdrawing.assignmentId },
                reason,
              ),
            );
            setWithdrawing(null);
            notify("Share revoked. QuipTech has been told.");
          }}
          onClose={() => setWithdrawing(null)}
        >
          <p>
            {withdrawing.targetName} stops seeing this machine through {withdrawing.group.name}. The rest of the group is
            unchanged.
          </p>
        </ReasonConfirmDialog>
      )}
    </section>
  );
};
