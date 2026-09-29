import type { BrandingPayload, OrganisationBranding } from "@/lib/types/organisationBranding";

// The FIELD colours an organisation starts with.
export const DEFAULT_PRIMARY_COLOR = "#4A34C7";
export const DEFAULT_ACCENT_COLOR = "#2CB8A6";

export const isHexColor = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);

export const toBrandingForm = (branding: OrganisationBranding): BrandingPayload => ({
  companyName: branding.companyName,
  primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
  accentColor: branding.accentColor ?? DEFAULT_ACCENT_COLOR,
  supportFooter: branding.supportFooter ?? "",
  showWatermark: branding.showWatermark,
});

// What's wrong with the form, if anything; the backend checks it again.
export const findBrandingProblem = (form: BrandingPayload): string | null => {
  if (!form.companyName.trim()) return "Enter the company name.";
  if (!isHexColor(form.primaryColor ?? "")) return "Primary colour must look like #4A34C7.";
  if (!isHexColor(form.accentColor ?? "")) return "Accent colour must look like #2CB8A6.";
  return null;
};

export const toBrandingPayload = (form: BrandingPayload): BrandingPayload => ({
  ...form,
  companyName: form.companyName.trim(),
  supportFooter: form.supportFooter?.trim() || null,
});
