// The branding columns of one tenants row (migrations 0003 and 0044).
export interface BrandingRow {
  id: string;
  name: string;
  branding_logo_url: string | null;
  branding_logo_storage_key: string | null;
  branding_color_primary: string | null;
  branding_color_accent: string | null;
  branding_support_footer: string | null;
  branding_show_watermark: boolean;
  updated_at: Date;
}
