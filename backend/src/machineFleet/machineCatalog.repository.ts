import { PoolClient } from 'pg';
import { OperatingStatus } from './types/machineFleetResponse';
import { CatalogModelRow } from './types/machineFleetRows';

// The organisation's own sites, makes and classes, for the filter panel.
export const listFleetFacets = async (client: PoolClient, tenantId: string) => {
  const sites = await client.query<{ site: string }>(
    `SELECT DISTINCT site FROM machines
     WHERE tenant_id = $1 AND deleted_at IS NULL AND site IS NOT NULL AND site <> ''
     ORDER BY site`,
    [tenantId],
  );
  const makes = await client.query<{ id: string; name: string }>(
    `SELECT DISTINCT mf.id, mf.name FROM machines m
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
     ORDER BY mf.name`,
    [tenantId],
  );
  const classes = await client.query<{ product_family: string }>(
    `SELECT DISTINCT mm.product_family FROM machines m
     JOIN machine_models mm ON mm.id = m.model_id
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
       AND mm.product_family IS NOT NULL AND mm.product_family <> ''
     ORDER BY mm.product_family`,
    [tenantId],
  );
  return {
    sites: sites.rows.map((row) => row.site),
    makes: makes.rows,
    classes: classes.rows.map((row) => row.product_family),
  };
};

// The models an organisation can register machines against: the shared
// Machine library plus its own private models. Grouped later by make.
export const listCatalogModels = async (
  client: PoolClient,
  tenantId: string,
): Promise<CatalogModelRow[]> => {
  const result = await client.query<CatalogModelRow>(
    `SELECT mf.id AS manufacturer_id, mf.name AS manufacturer_name,
            mm.id AS model_id, mm.name AS model_name, mm.product_family
     FROM machine_models mm
     JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
     WHERE mm.deleted_at IS NULL AND mf.deleted_at IS NULL
       AND (mm.tenant_id IS NULL OR mm.tenant_id = $1)
     ORDER BY mf.name, mm.name`,
    [tenantId],
  );
  return result.rows;
};

// null when the model doesn't exist or is another organisation's.
export const findModelManufacturerId = async (
  client: PoolClient,
  params: { modelId: string; tenantId: string },
): Promise<string | null> => {
  const result = await client.query<{ manufacturer_id: string }>(
    `SELECT manufacturer_id FROM machine_models
     WHERE id = $1 AND deleted_at IS NULL
       AND (tenant_id IS NULL OR tenant_id = $2)`,
    [params.modelId, params.tenantId],
  );
  return result.rows[0]?.manufacturer_id ?? null;
};

// A duplicate serial in the organisation is a unique violation (23505).
export const insertMachine = async (
  client: PoolClient,
  params: {
    tenantId: string;
    createdBy: string;
    manufacturerId: string;
    modelId: string;
    serialNumber: string;
    assetNumber: string | null;
    site: string | null;
    operatingHours: number | null;
    status: OperatingStatus;
  },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO machines (tenant_id, created_by, manufacturer_id, model_id, serial_number,
                           asset_number, site, operating_hours, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      params.tenantId,
      params.createdBy,
      params.manufacturerId,
      params.modelId,
      params.serialNumber,
      params.assetNumber,
      params.site,
      params.operatingHours,
      params.status,
    ],
  );
  return result.rows[0].id;
};
