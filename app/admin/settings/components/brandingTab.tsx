"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useBranding } from "../useBranding";
import { BrandingEditor } from "./brandingEditor";

// Settings → Branding for the signed-in admin's own organisation.
export const BrandingTab = () => {
  const { branding, isLoading, loadError, ...actions } = useBranding();

  if (isLoading && !branding) {
    return (
      <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
        <LoadingSpinner /> Loading branding…
      </span>
    );
  }
  if (loadError || !branding) return <span className="text-sm text-danger">{loadError}</span>;
  // Keyed by organisation so the form starts from that organisation's
  // saved values; saving keeps the editor (and its notice) in place.
  return <BrandingEditor key={branding.organisationId} branding={branding} {...actions} />;
};
