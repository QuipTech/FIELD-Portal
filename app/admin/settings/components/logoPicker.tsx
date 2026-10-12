"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { OrganisationBranding } from "@/lib/types/organisationBranding";

interface LogoPickerProps {
  branding: OrganisationBranding;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

// Uploads immediately — the logo isn't part of "Save branding".
export const LogoPicker = ({ branding, onUpload, onRemove }: LogoPickerProps) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setIsWorking(true);
    setLogoError(null);
    try {
      await action();
    } catch (error) {
      setLogoError(toApiErrorMessage(error, "Couldn't update the logo. Please try again."));
    } finally {
      setIsWorking(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void run(() => onUpload(file));
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-[76px] w-[76px] flex-none items-center justify-center overflow-hidden rounded-xl border border-borderGrayStrong bg-fillGray text-xs text-mutedGray">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
          <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="h-full w-full object-contain" />
        ) : (
          "Logo"
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button size="sm" type="button" onClick={() => fileInput.current?.click()} disabled={isWorking}>
            <Icon name="upload" className="h-3.5 w-3.5" />
            {isWorking ? "Working…" : "Upload logo"}
          </Button>
          {branding.hasUploadedLogo && (
            <Button size="sm" type="button" variant="ghost" onClick={() => run(onRemove)} disabled={isWorking}>
              Remove
            </Button>
          )}
        </div>
        <span className="text-xs text-mutedGray">PNG, JPG or SVG, square, min 256px, up to 2 MB</span>
        {logoError && <span className="text-xs text-danger">{logoError}</span>}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
};
