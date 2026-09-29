"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getBrandingRequest, removeLogoRequest, saveBrandingRequest, uploadLogoRequest } from "@/lib/api/brandingApi";
import type { BrandingPayload } from "@/lib/types/organisationBranding";

// The signed-in admin's own organisation's branding. Each action rejects
// with the API's error so the calling control can show it.
export const useBranding = () => {
  const branding = useApiResource(getBrandingRequest, [], "Couldn't load your branding. Please try again.");

  const saveBranding = async (payload: BrandingPayload) => {
    branding.setData(await saveBrandingRequest(requireAccessToken(), payload));
  };

  const uploadLogo = async (file: File) => {
    branding.setData(await uploadLogoRequest(requireAccessToken(), file));
  };

  const removeLogo = async () => {
    branding.setData(await removeLogoRequest(requireAccessToken()));
  };

  return {
    branding: branding.data,
    isLoading: branding.isLoading,
    loadError: branding.error,
    saveBranding,
    uploadLogo,
    removeLogo,
  };
};

export type BrandingActions = Pick<ReturnType<typeof useBranding>, "saveBranding" | "uploadLogo" | "removeLogo">;
