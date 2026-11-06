"use client";

import { useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { ConnectMachineAppDialog } from "@/components/machines/machineApp/connectMachineAppDialog";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { Card } from "@/components/ui/card";
import { ComingSoonButton } from "@/components/ui/comingSoonButton";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { disconnectMachineAppRequest, getMachineAppConnectionRequest } from "@/lib/api/machineAppConnectionApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { formatShortDateTime } from "@/lib/format/shortDate";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { useMachineDetail } from "../machineDetailContext";

// Machine app tab: connect this machine's tablet, then reach it remotely.
const MachineAppPage = () => {
  const { machineId, machine, notify } = useMachineDetail();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const connection = useCachedResource(
    machineCacheKeys.appConnection(machineId),
    () => getMachineAppConnectionRequest(machineId),
    "Couldn't load this machine's connection.",
  );
  const canManage = canContributeTo(machine);
  const label = machine?.assetId ?? "";
  const device = connection.data?.device ?? null;

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
      {!device ? (
        <EmptyState
          icon="cloud"
          title="Machine app not connected"
          description="Connect this machine's tablet to the FIELD machine app with a 6-digit code."
          actions={
            canManage && (
              <PermissionButton permission={PERMISSIONS.manageMachine} variant="primary" onClick={() => setIsConnecting(true)}>
                <Icon name="cloud" />
                Connect app
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
            <span className="text-sm text-bodyGray">Since {formatShortDateTime(device.pairedAt)}</span>
            {canManage && (
              <PermissionButton permission={PERMISSIONS.manageMachine} size="sm" variant="ghost" className="ml-auto" onClick={() => setIsDisconnecting(true)}>
                Disconnect
              </PermissionButton>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-bodyGray">
            {device.serialNumber && <span>Tablet serial: {device.serialNumber}</span>}
            {device.platform && <span className="capitalize">{device.platform}</span>}
            {device.appVersion && <span>App version {device.appVersion}</span>}
          </div>
          <div className="mt-2 flex flex-col items-start gap-2 border-t border-borderGray pt-4">
            <span className="text-[15px] font-medium text-ink">Remote access</span>
            <p className="text-sm text-bodyGray">See and control this machine&apos;s tablet from here.</p>
            <ComingSoonButton
              label="Connect as remote access"
              className={`${buttonBaseClasses} ${buttonVariantClasses.primary} ${buttonSizeClasses.md} !flex-none`}
            >
              Connect as remote access
            </ComingSoonButton>
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
      {isDisconnecting && (
        <ConfirmDialog
          title="Disconnect machine app"
          confirmLabel="Disconnect"
          onConfirm={async () => {
            await disconnectMachineAppRequest(machineId);
            connection.reload();
            notify("Machine app disconnected");
          }}
          onClose={() => setIsDisconnecting(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't disconnect. Please try again.")}
        >
          The tablet on {label} stops being connected, and needs a new code to connect again.
        </ConfirmDialog>
      )}
    </section>
  );
};

export default MachineAppPage;
