"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";

export const ManageTwoFactorButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [phone, setPhone] = useState("+1 •••• •••• 214");

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        Manage
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40">
          <div className="flex w-[420px] flex-col overflow-y-auto rounded-2xl bg-white">
            <div className="flex h-14 flex-none items-center border-b border-borderGray px-4">
              <span className="text-[15px] font-medium text-ink">Two-factor authentication</span>
              <button onClick={() => setIsOpen(false)} className="ml-auto text-bodyGray">
                <Icon name="x" />
              </button>
            </div>
            <div className="flex flex-col gap-3.5 p-5">
              <div className="flex items-center gap-2.5 rounded-xl border border-borderGray p-3.5">
                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primary">
                  <Icon name="shield" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-ink">SMS authentication</span>
                  <span className="text-xs text-mutedGray">Codes are sent to your phone on sign-in</span>
                </div>
                <div className="ml-auto flex flex-none items-center gap-2.5">
                  <Tag tone={isEnabled ? "ok" : "default"}>{isEnabled ? "On" : "Off"}</Tag>
                  <Switch on={isEnabled} onToggle={() => setIsEnabled((value) => !value)} />
                </div>
              </div>

              {isEnabled && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-borderGray p-3.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Phone number</span>
                  <Input icon="life" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <span className="text-xs text-mutedGray">
                    We&apos;ll text a 6-digit code to this number when you sign in.
                  </span>
                </div>
              )}

              <div className="flex">
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" className="ml-auto" onClick={() => setIsOpen(false)}>
                  <Icon name="check" />
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
