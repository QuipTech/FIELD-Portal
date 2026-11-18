import { PoolClient } from 'pg';
import { MACHINE_LABEL_SQL } from '../../machineFleet/machineFleet.repository';
import { DesignFile, PreviewDesignDelivery } from './designDelivery.types';

export interface DesignVersion {
  id: string;
  projectId: string;
  project: string;
  createdAt: Date;
  files: DesignFile[];
}

export interface DesignTarget {
  deviceId: string;
  machineId: string;
  tenantId: string;
  organisation: string;
  label: string;
  site: string | null;
}

const columns = `v.id, v.project_id AS "projectId", p.name AS project,
  v.created_at AS "createdAt", v.files`;

export const listVersions = (client: PoolClient, tenantId: string) =>
  client.query<DesignVersion>(
    `SELECT ${columns} FROM mc_design_versions v
     JOIN mc_design_projects p ON p.id = v.project_id
     WHERE v.tenant_id = $1 ORDER BY p.name, v.created_at DESC, v.id`,
    [tenantId],
  );

export const findVersion = async (
  client: PoolClient,
  tenantId: string,
  id: string,
) =>
  (
    await client.query<DesignVersion>(
      `SELECT ${columns} FROM mc_design_versions v
     JOIN mc_design_projects p ON p.id = v.project_id
     WHERE v.tenant_id = $1 AND v.id = $2`,
      [tenantId, id],
    )
  ).rows[0];

export const insertVersion = async (
  client: PoolClient,
  tenantId: string,
  project: string,
  files: DesignFile[],
) => {
  await client.query(
    `INSERT INTO mc_design_projects (tenant_id, name) VALUES ($1, $2)
     ON CONFLICT (tenant_id, name) DO NOTHING`,
    [tenantId, project],
  );
  const { rows } = await client.query<DesignVersion>(
    `INSERT INTO mc_design_versions (tenant_id, project_id, files)
     SELECT $1, id, $3::jsonb FROM mc_design_projects WHERE tenant_id = $1 AND name = $2
     RETURNING id, project_id AS "projectId", created_at AS "createdAt", files`,
    [tenantId, project, JSON.stringify(files)],
  );
  return { ...rows[0], project };
};

export const listTargets = (
  client: PoolClient,
  tenantId: string,
  request?: PreviewDesignDelivery,
) =>
  client.query<DesignTarget>(
    `SELECT d.id AS "deviceId", m.id AS "machineId", m.tenant_id AS "tenantId",
            ${MACHINE_LABEL_SQL} AS label, m.site, t.name AS organisation
     FROM mc_devices d
     JOIN machines m ON m.id = d.machine_id AND m.tenant_id = d.tenant_id
     JOIN tenants t ON t.id = m.tenant_id
       AND t.deleted_at IS NULL AND t.machine_control_enabled
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     WHERE d.disabled_at IS NULL AND d.deleted_at IS NULL
       AND m.deleted_at IS NULL AND m.lifecycle_state = 'active'
       AND EXISTS (
         SELECT 1 FROM accessible_machines() a WHERE a.machine_id = m.id
           AND a.access_level <> 'view' AND (a.tenant_id = $1 OR a.is_shared)
       )
       AND ($2::uuid[] IS NULL OR m.id = ANY($2))
       AND ($3::uuid IS NULL OR (m.tenant_id = $3 AND m.site = $4))
     ORDER BY m.id`,
    [
      tenantId,
      request?.machineIds ?? null,
      request?.siteTenantId ?? null,
      request?.site ?? null,
    ],
  );

export const previousDesigns = (
  client: PoolClient,
  projectId: string,
  deviceIds: string[],
) =>
  client.query<{
    deviceId: string;
    versionId: string;
    paths: string[];
    status: string;
  }>(
    `SELECT DISTINCT ON (d.device_id) d.device_id AS "deviceId",
            d.version_id AS "versionId", d.status,
            ARRAY(SELECT f->>'path' FROM jsonb_array_elements(v.files) f) AS paths
     FROM mc_design_deliveries d JOIN mc_design_versions v ON v.id = d.version_id
     WHERE d.project_id = $1 AND d.device_id = ANY($2::uuid[]) AND d.status <> 'failed'
     ORDER BY d.device_id, d.created_at DESC, d.id DESC`,
    [projectId, deviceIds],
  );

export const insertDeliveries = (
  client: PoolClient,
  tenantId: string,
  version: DesignVersion,
  batchId: string,
  previewHash: string,
  targets: DesignTarget[],
) =>
  client.query(
    `INSERT INTO mc_design_deliveries
     (sender_tenant_id, device_tenant_id, device_id, machine_id, machine_label, site,
      project_id, version_id, batch_id, project_name, preview_hash, created_at)
   SELECT $1, t."tenantId", t."deviceId", t."machineId", t.label, t.site, $2, $3, $4, $6, $7, clock_timestamp()
   FROM jsonb_to_recordset($5::jsonb)
     AS t("tenantId" uuid, "deviceId" uuid, "machineId" uuid, label text, site text)`,
    [
      tenantId,
      version.projectId,
      version.id,
      batchId,
      JSON.stringify(targets),
      version.project,
      previewHash,
    ],
  );

export const listDeliveries = (client: PoolClient, tenantId: string) =>
  client.query(
    `SELECT d.id, d.version_id AS "versionId", d.project_name AS project, v.created_at AS "versionCreatedAt",
            d.machine_id AS "machineId", d.machine_label AS "machineLabel", d.site,
            CASE WHEN d.status IN ('waiting', 'downloading') AND md.id IS NULL THEN 'failed' ELSE d.status END AS status,
            CASE WHEN d.status IN ('waiting', 'downloading') AND md.id IS NULL THEN 'The tablet was disconnected. Send again after pairing a tablet.'
            ELSE d.error END AS error,
            d.created_at AS "createdAt", d.updated_at AS "updatedAt"
     FROM mc_design_deliveries d JOIN mc_design_versions v ON v.id = d.version_id
     LEFT JOIN mc_devices md ON md.id = d.device_id
       AND md.disabled_at IS NULL AND md.deleted_at IS NULL
     WHERE (d.sender_tenant_id = $1 OR d.device_tenant_id = $1)
       AND d.machine_id IN (SELECT machine_id FROM accessible_machines())
     ORDER BY d.created_at DESC, d.id DESC`,
    [tenantId],
  );
