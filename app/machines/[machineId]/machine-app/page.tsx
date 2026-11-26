"use client";

import Link from "next/link";
import { useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { ConnectMachineAppDialog } from "@/components/machines/machineApp/connectMachineAppDialog";
import { RemoteSessionButton } from "@/components/machines/machineApp/remoteSessionButton";
import { ResetTabletPasswordDialog } from "@/components/machines/machineApp/resetTabletPasswordDialog";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { disconnectMachineAppRequest } from "@/lib/api/machineAppConnectionApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { formatShortDateTime } from "@/lib/format/shortDate";
import { formatFieldId } from "@/lib/types/machineAppConnection";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import { useMachineAppStatus } from "@/components/machines/machineApp/useMachineAppStatus";
import { useMachineDetail } from "../machineDetailContext";
import { usePermissions } from "@/lib/auth/usePermissions";
import { MachineControlOffNotice } from "@/components/machineControl/machineControlOffNotice";

// Machine app tab: add this machine's tablet, then reach it remotely.
const MachineAppPage = () => {
  const { machineId, machine, notify } = useMachineDetail();
  const { machineControlEnabled } = usePermissions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const connection = useMachineAppStatus(machineId, machineControlEnabled);
  const canManage = canContributeTo(machine);
  const label = machine?.assetId ?? "";
  const device = connection.data?.device ?? null;

  if (!machineControlEnabled) return <MachineControlOffNotice />;
  if (connection.isLoading && !connection.data) {
    return (
      <div className="flex justify-center py-10 text-mutedGray">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  if (connection.error && !connection.data) return <LoadErrorState message={connection.error} onRetry={connection.reload} />;

  return (
    <section className="flex flex-col gap-4">
      {connection.error && <p role="status" className="text-sm text-bodyGray">{connection.error}</p>}
      {!device ? (
        <EmptyState
          icon="cloud"
          title="No tablet on this machine"
          description="Add this machine's tablet with the FIELD ID and password the FIELD machine app shows."
          actions={
            canManage && (
              <PermissionButton permission={PERMISSIONS.manageMachineControlDevices} variant="primary" onClick={() => setIsConnecting(true)}>
                <Icon name="cloud" />
                Add tablet
              </PermissionButton>
            )
          }
        />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="ok">
              <Icon name="check" className="h-3.5 w-3.5" />
              Connected
            </Tag>
            <Tag tone={!connection.error && connection.data?.session?.tabletOnline ? "ok" : "default"}>
              {connection.error || !connection.data?.session ? "Status unavailable" : connection.data.session.tabletOnline ? "Online" : "Offline"}
            </Tag>
            <span className="text-sm text-bodyGray">Since {formatShortDateTime(device.pairedAt)}</span>
            {canManage && (
              <PermissionButton permission={PERMISSIONS.manageMachineControlDevices} size="sm" variant="ghost" className="ml-auto" onClick={() => setIsDisconnecting(true)}>
                Remove
              </PermissionButton>
            )}
          </div>
          {device.fieldId && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-bodyGray">
              <span>
                FIELD ID: <span className="font-mono text-[15px] font-medium text-ink">{formatFieldId(device.fieldId)}</span>
              </span>
              {canManage && (
                <PermissionButton permission={PERMISSIONS.manageMachineControlDevices} size="sm" variant="ghost" onClick={() => setIsChangingPassword(true)}>
                  Change password
                </PermissionButton>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-bodyGray">
            {device.serialNumber && <span>Tablet serial: {device.serialNumber}</span>}
            {device.platform && <span className="capitalize">{device.platform}</span>}
            {device.appVersion && <span>App version {device.appVersion}</span>}
          </div>
          <div className="flex flex-col items-start gap-2 border-t border-borderGray pt-4">
            <span className="text-[15px] font-medium text-ink">File transfer</span>
            <p className="text-sm text-bodyGray">Use Send to Portal on the paired tablet. Files appear automatically in this machine&apos;s Documents.</p>
            <Link
              href={`/machines/${machineId}/documents`}
              className={`${buttonBaseClasses} ${buttonVariantClasses.primary} ${buttonSizeClasses.md}`}
            >
              <Icon name="file" />
              View machine documents
            </Link>
          </div>
          <div className="mt-2 flex flex-col items-start gap-2 border-t border-borderGray pt-4">
            <span className="text-[15px] font-medium text-ink">Remote access</span>
            <p className="text-sm text-bodyGray">
              {device.fieldId
                ? "See and control this machine's tablet in a new window with its password. Nobody has to accept on the tablet, and every session is recorded to this machine's History."
                : "See and control this machine's tablet in a new window. The operator allows each session on the tablet. Update the FIELD machine app to connect with a FIELD ID and password."}
            </p>
            <RemoteSessionButton
              machineId={machineId}
              machineLabel={label}
              hasFieldId={Boolean(device.fieldId)}
              tabletOnline={!connection.error && Boolean(connection.data?.session?.tabletOnline)}
            />
          </div>
        </Card>
      )}
      {isConnecting && (
        <ConnectMachineAppDialog
          machineId={machineId}
          machineLabel={label}
          onConnected={() => {
            setIsConnecting(false);
            connection.reload();
          }}
          onClose={() => {
            setIsConnecting(false);
            connection.reload();
          }}
        />
      )}
      {isChangingPassword && (
        <ResetTabletPasswordDialog
          machineId={machineId}
          machineLabel={label}
          onSaved={() => {
            setIsChangingPassword(false);
            notify("Tablet password changed");
          }}
          onClose={() => setIsChangingPassword(false)}
        />
      )}
      {isDisconnecting && (
        <ConfirmDialog
          title="Remove tablet"
          confirmLabel="Remove"
          onConfirm={async () => {
            await disconnectMachineAppRequest(machineId);
            connection.reload();
            notify("Tablet removed");
          }}
          onClose={() => setIsDisconnecting(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't remove the tablet. Please try again.")}
        >
          The tablet is taken off {label}. It keeps its FIELD ID and password, and can be added again with them.
        </ConfirmDialog>
      )}
    </section>
  );
};

export default MachineAppPage;
