"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";

type DeleteStage = "idle" | "confirm" | "done";

export const DeleteAccountButton = () => {
  const router = useRouter();
  const [stage, setStage] = useState<DeleteStage>("idle");

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setStage("confirm")}>
        Request deletion
      </Button>

      {stage === "confirm" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40">
          <div className="flex w-[380px] flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dangerTint text-danger">
              <Icon name="alert" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-medium text-ink">Delete your account?</h2>
              <p className="text-[13px] text-mutedGray">
                This removes your profile and sign-in. Asset and configuration records stay on the tenant&apos;s
                CMDB. This can&apos;t be undone.
              </p>
            </div>
            <div className="flex w-full gap-2">
              <Button className="flex-1" onClick={() => setStage("idle")}>
                No, keep account
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setStage("done")}>
                Yes, delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40">
          <div className="flex w-[380px] flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primaryTint text-primary">
              <Icon name="check" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-medium text-ink">Your account has been terminated</h2>
              <p className="text-[13px] text-mutedGray">You&apos;ll be signed out and returned to sign-in.</p>
            </div>
            <Button variant="primary" className="w-full" onClick={() => router.push("/login")}>
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
