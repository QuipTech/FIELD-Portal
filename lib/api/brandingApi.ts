import { apiRequest } from "./httpClient";
import { uploadMultipart } from "./multipartUpload";
import type { BrandingPayload, OrganisationBranding } from "../types/organisationBranding";

// The signed-in user's own organisation. Anyone can read it; saving,
// uploading and removing the logo need the Owner role (else 403).
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const getBrandingRequest = (accessToken: string) =>
  apiRequest<OrganisationBranding>("/organisation/branding", { headers: authorizationHeader(accessToken) });

export const saveBrandingRequest = (accessToken: string, payload: BrandingPayload) =>
  apiRequest<OrganisationBranding>("/organisation/branding", {
    method: "PUT",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });

// PNG, JPG or script-free SVG, up to 2 MB.
export const uploadLogoRequest = (accessToken: string, file: File) =>
  uploadMultipart<OrganisationBranding>("/organisation/branding/logo", { accessToken, file });

export const removeLogoRequest = (accessToken: string) =>
  apiRequest<OrganisationBranding>("/organisation/branding/logo", {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });
