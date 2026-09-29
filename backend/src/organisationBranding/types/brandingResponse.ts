export interface OrganisationBranding {
  organisationId: string;
  companyName: string;
  // A 15-minute signed URL for an uploaded logo, else the stored URL.
  logoUrl: string | null;
  hasUploadedLogo: boolean;
  // #RRGGBB; null = the FIELD default.
  primaryColor: string | null;
  accentColor: string | null;
  supportFooter: string | null;
  showWatermark: boolean;
  updatedAt: string;
}
