"use client";

import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Modal } from "@/components/ui/modal";
import { formatCodeTimeLeft, formatPairingCode } from "@/lib/types/machineAppConnection";
import { useMachinePairing } from "./useMachinePairing";

interface ConnectMachineAppDialogProps {
  machineId: string;
  machineLabel: string;
  // "Continue", once the machine has connected.
  onConnected: () => void;
  onClose: () => void;
}

// A code for this machine only, shown until the machine's tablet uses it.
export const ConnectMachineAppDialog = ({ machineId, machineLabel, onConnected, onClose }: ConnectMachineAppDialogProps) => {
  const { state, now, requestCode } = useMachinePairing(machineId);

  return (
    <Modal title={`Connect machine app — ${machineLabel}`} onClose={onClose} widthClassName="w-[460px]">
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        {state.step === "loading" && (
          <div className="py-8 text-mutedGray">
            <LoadingSpinner size="md" />
          </div>
        )}
        {state.step === "waiting" && (
          <>
            <p className="text-sm text-bodyGray">
              Open the FIELD machine app on this machine&apos;s tablet and enter this code.
            </p>
            <span aria-label={`Pairing code ${state.code}`} className="py-2 font-mono text-[40px] font-medium tracking-[0.12em] text-ink">
              {formatPairingCode(state.code)}
            </span>
            <span className="text-xs text-mutedGray">Works for {machineLabel} only. Expires in {formatCodeTimeLeft(state.expiresAt, now)}.</span>
            <span role="status" className="mt-2 flex items-center gap-2 text-sm text-bodyGray">
              <LoadingSpinner size="sm" />
              Waiting for the machine to connect…
            </span>
          </>
        )}
        {state.step === "expired" && (
          <>
            <p className="py-3 text-sm text-bodyGray">This code has expired, so the machine didn&apos;t connect.</p>
            <Button variant="primary" onClick={() => void requestCode()}>Get a new code</Button>
          </>
        )}
        {state.step === "failed" && (
          <>
            <p role="alert" className="py-3 text-sm text-danger">{state.message}</p>
            <Button onClick={() => void requestCode()}>Try again</Button>
          </>
        )}
        {state.step === "connected" && (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fillGray text-primary">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <span role="status" className="text-[17px] font-medium text-ink">{machineLabel} is connected</span>
            <p className="text-sm text-bodyGray">The machine app paired successfully.</p>
            <Button variant="primary" className="mt-2" onClick={onConnected}>Continue</Button>
          </>
        )}
      </div>
    </Modal>
  );
};
