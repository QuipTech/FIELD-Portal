import { PoolClient } from 'pg';
import { UpdateBrandingDto } from './dto/updateBrandingDto';
import { BrandingRow } from './types/brandingRows';

// tenants has no RLS: every query here is pinned to one tenant id, which
// callers take from the signed-in user, never from the request.
const BRANDING_COLUMNS = `id, name, branding_logo_url, branding_logo_storage_key,
  branding_color_primary, branding_color_accent, branding_support_footer,
  branding_show_watermark, updated_at`;

export const findBranding = async (
  client: PoolClient,
  tenantId: string,
): Promise<BrandingRow | undefined> => {
  const result = await client.query<BrandingRow>(
    `SELECT ${BRANDING_COLUMNS} FROM tenants
     WHERE id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );
  return result.rows[0];
};

export const updateBranding = async (
  client: PoolClient,
  tenantId: string,
  branding: UpdateBrandingDto,
): Promise<BrandingRow | undefined> => {
  const result = await client.query<BrandingRow>(
    `UPDATE tenants
     SET name = $2,
         branding_color_primary = $3,
         branding_color_accent = $4,
         branding_support_footer = $5,
         branding_show_watermark = $6
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${BRANDING_COLUMNS}`,
    [
      tenantId,
      branding.companyName,
      branding.primaryColor?.toUpperCase() ?? null,
      branding.accentColor?.toUpperCase() ?? null,
      branding.supportFooter || null,
      branding.showWatermark,
    ],
  );
  return result.rows[0];
};

// null removes the uploaded logo.
export const setLogoStorageKey = async (
  client: PoolClient,
  tenantId: string,
  key: string | null,
): Promise<BrandingRow | undefined> => {
  const result = await client.query<BrandingRow>(
    `UPDATE tenants SET branding_logo_storage_key = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${BRANDING_COLUMNS}`,
    [tenantId, key],
  );
  return result.rows[0];
};
