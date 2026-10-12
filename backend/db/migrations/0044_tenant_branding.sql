-- Section 1k: the rest of an organisation's branding (Settings → Branding).
-- 0003 gave tenants branding_logo_url and branding_color_primary; this
-- adds the accent colour, the support footer shown on emails and case
-- receipts, the FIELD watermark toggle, and the S3 key of an uploaded
-- logo (which takes precedence over branding_logo_url). tenants has no
-- RLS, so the backend scopes every read and write to the caller's own
-- tenant id.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS branding_color_accent       varchar,
  ADD COLUMN IF NOT EXISTS branding_support_footer     varchar,
  ADD COLUMN IF NOT EXISTS branding_show_watermark     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS branding_logo_storage_key   varchar;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_branding_colors_hex') THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_branding_colors_hex CHECK (
      (branding_color_primary IS NULL OR branding_color_primary ~ '^#[0-9A-Fa-f]{6}$') AND
      (branding_color_accent IS NULL OR branding_color_accent ~ '^#[0-9A-Fa-f]{6}$')
    ) NOT VALID;
  END IF;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0044_tenant_branding')
ON CONFLICT (version) DO NOTHING;
