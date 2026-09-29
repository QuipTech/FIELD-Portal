"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";

type Method = "sms" | "email";

const RadioDot = ({ selected }: { selected: boolean }) => (
  <span
    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
      selected ? "border-primary" : "border-borderGrayStrong"
    }`}
  >
    {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
  </span>
);

const TwoFactorSetupPage = () => {
  const [method, setMethod] = useState<Method>("sms");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surfaceGray p-6">
      <div className="flex w-full max-w-[520px] flex-col gap-3.5 rounded-2xl bg-surface p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-medium text-ink">Secure your account</h1>
          <span className="text-xs text-mutedGray">Choose how you&apos;d like to receive your verification code</span>
        </div>
        <button
          onClick={() => setMethod("sms")}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left ${
            method === "sms" ? "border-primary ring-2 ring-primaryTint" : "border-borderGray"
          }`}
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primaryTintText">
            <Icon name="life" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium text-ink">Text message (SMS)</span>
            <span className="text-xs text-mutedGray">Codes sent to •••• •••• 214</span>
          </div>
          <span className="ml-auto"><RadioDot selected={method === "sms"} /></span>
        </button>
        <button
          onClick={() => setMethod("email")}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left ${
            method === "email" ? "border-primary ring-2 ring-primaryTint" : "border-borderGray"
          }`}
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-fillGray text-bodyGray">
            <Icon name="msg" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium text-ink">Email code</span>
            <span className="text-xs text-mutedGray">Sent to j.okoye@quiptech.com</span>
          </div>
          <span className="ml-auto"><RadioDot selected={method === "email"} /></span>
        </button>
        <p className="text-xs text-mutedGray">
          You can change your method any time in Profile &amp; settings → Security.
        </p>
        <Button variant="primary" className="h-11">
          Continue
        </Button>
      </div>
    </div>
  );
};

export default TwoFactorSetupPage;
