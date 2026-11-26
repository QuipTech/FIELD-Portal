"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/formField";
import { Input } from "@/components/ui/input";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { connectByFieldIdRequest, createRemoteSessionRequest } from "@/lib/api/remoteSessionApi";
import { isFieldId, normaliseFieldId } from "@/lib/types/machineAppConnection";
import type { RemoteSession } from "@/lib/types/remoteSession";

interface RemoteConnectFormProps {
  // Omit to ask for the tablet's FIELD ID as well.
  machineId?: string;
  machineLabel?: string;
  onStarted: (session: RemoteSession) => void;
}

// The password (and FIELD ID) that opens a session, with full access or view
// only. Nothing is asked on the tablet.
export const RemoteConnectForm = ({ machineId, machineLabel, onStarted }: RemoteConnectFormProps) => {
  const [fieldId, setFieldId] = useState("");
  const [password, setPassword] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsConnecting(true);
    try {
      onStarted(
        machineId
          ? await createRemoteSessionRequest(machineId, !viewOnly, password)
          : await connectByFieldIdRequest(normaliseFieldId(fieldId), password, !viewOnly),
      );
    } catch (connectError) {
      setError(toApiErrorMessage(connectError, "Couldn't start a remote session."));
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surfaceGray p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-surface p-6">
        <h1 className="text-lg font-medium text-ink">
          {machineId ? `Connect to ${machineLabel || "this machine"}` : "Connect by FIELD ID"}
        </h1>
        {!machineId && (
          <FormField label="FIELD ID">
            <Input value={fieldId} onChange={(event) => setFieldId(event.target.value)} placeholder="482 915 307" inputMode="numeric" autoComplete="off" autoFocus />
          </FormField>
        )}
        <FormField label="Password">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" autoFocus={Boolean(machineId)} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-bodyGray">
          <input type="checkbox" checked={viewOnly} onChange={(event) => setViewOnly(event.target.checked)} />
          View only (no tapping or typing on the tablet)
        </label>
        <p className="text-xs text-mutedGray">
          The session starts at once, without the operator accepting, and is recorded to the machine&apos;s History.
        </p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={isConnecting || !password || (!machineId && !isFieldId(fieldId))}>
          {isConnecting ? "Connecting…" : "Connect"}
        </Button>
      </form>
    </div>
  );
};
