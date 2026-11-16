import { PoolClient } from 'pg';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { toLimitOffset } from '../common/dto/paginationQueryDto';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { FeaturedDownRow, FleetMachineRow } from './types/machineFleetRows';
import { OperatingStatus } from './types/machineFleetResponse';
import {
  MachineScope,
  ownMachineSql,
  visibleMachineSql,
} from '../machineSharing/access/machineScope';
import { MACHINE_GROUPS_SQL } from '../machineSharing/access/machineGroupsSql';

// Reads go through the caller's machine scope (machineSharing/access): their
// own organisation's machines they may see plus machines shared with them;
// anything else doesn't exist for them. Changes are own-organisation only.
export const MACHINE_LABEL_SQL = `COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)`;

// The storage key of the machine's photo (alias m): its chosen cover, else
// its newest gallery photo; NULL with none.
export const MACHINE_PHOTO_KEY_SQL = `(
  SELECT p.storage_key FROM machine_photos p
  WHERE p.machine_id = m.id AND p.tenant_id = m.tenant_id AND p.deleted_at IS NULL
  ORDER BY (p.id = m.cover_photo_id) IS TRUE DESC, p.created_at DESC
  LIMIT 1)`;

// The photos each machine's list row can slide through, up to `limit` each:
// its cover, then newest first. HEIC is left out, as browsers can't show it.
export const listRowPhotoKeys = async (
  client: PoolClient,
  machineIds: string[],
  limit: number,
): Promise<{ machine_id: string; storage_key: string }[]> => {
  const result = await client.query<{
    machine_id: string;
    storage_key: string;
  }>(
    `SELECT machine_id, storage_key FROM (
       SELECT p.machine_id, p.storage_key,
              row_number() OVER (
                PARTITION BY p.machine_id
                ORDER BY (p.id = m.cover_photo_id) IS TRUE DESC, p.created_at DESC
              ) AS position
       FROM machine_photos p
       JOIN machines m ON m.id = p.machine_id AND m.tenant_id = p.tenant_id
       WHERE p.machine_id = ANY($1::uuid[]) AND p.deleted_at IS NULL
         AND COALESCE(lower(p.content_type), '') <> 'image/heic'
     ) ranked
     WHERE position <= $2
     ORDER BY machine_id, position`,
    [machineIds, limit],
  );
  return result.rows;
};

export const FLEET_COLUMNS = `
  m.id, ${MACHINE_LABEL_SQL} AS label, m.serial_number,
  mf.name AS manufacturer_name, mm.name AS model_name, mm.product_family,
  m.site, m.operating_hours, m.status, m.lifecycle_state,
  t.name AS owning_organisation_name,
  COALESCE(am.access_level, 'owner') AS access_level,
  COALESCE(am.is_shared, false) AS is_shared,
  EXISTS (SELECT 1 FROM mc_devices d WHERE d.machine_id = m.id AND d.disabled_at IS NULL AND d.deleted_at IS NULL) AS app_connected,
  ${MACHINE_GROUPS_SQL} AS groups,
  ${MACHINE_PHOTO_KEY_SQL} AS photo_storage_key`;

// accessible_machines() gives the caller's level; staff and jobs reading one
// organisation ('all' scope) have none, and count as the owner.
export const FLEET_FROM = `
  FROM machines m
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN machine_models mm ON mm.id = m.model_id
  JOIN tenants t ON t.id = m.tenant_id
  LEFT JOIN accessible_machines() am ON am.machine_id = m.id`;

export interface FleetScope {
  tenantId: string;
  // Who "assigned to me" means.
  viewerId: string;
  machineScope: MachineScope;
}

// WHERE clause and its parameters for the list's filters ($1 = the
// caller's organisation).
const buildFilter = (scope: FleetScope, filters: ListMachinesQueryDto) => {
  const params: unknown[] = [scope.tenantId];
  const conditions = [
    'm.deleted_at IS NULL',
    visibleMachineSql('m', '$1', scope.machineScope),
  ];
  if (filters.source === 'own') conditions.push('m.tenant_id = $1');
  if (filters.source === 'shared') conditions.push('m.tenant_id <> $1');
  const addCondition = (value: unknown, toSql: (param: string) => string) => {
    params.push(value);
    conditions.push(toSql(`$${params.length}`));
  };
  if (filters.site) addCondition(filters.site, (p) => `m.site = ${p}`);
  if (filters.make)
    addCondition(filters.make, (p) => `m.manufacturer_id = ${p}`);
  if (filters.status) addCondition(filters.status, (p) => `m.status = ${p}`);
  if (filters.lifecycleState)
    addCondition(filters.lifecycleState, (p) => `m.lifecycle_state = ${p}`);
  if (filters.machineClass) {
    addCondition(
      filters.machineClass,
      (p) => `lower(mm.product_family) = lower(${p})`,
    );
  }
  if (filters.groupId) {
    addCondition(
      filters.groupId,
      (p) => `EXISTS (SELECT 1 FROM machine_group_machines gm
                      WHERE gm.machine_id = m.id AND gm.group_id = ${p})`,
    );
  }
  if (filters.assignedToMe) {
    addCondition(
      scope.viewerId,
      (p) => `EXISTS (SELECT 1 FROM machine_assignments a
                      WHERE a.machine_id = m.id AND a.tenant_id = m.tenant_id AND a.user_id = ${p})`,
    );
  }
  if (filters.search) {
    addCondition(
      `%${escapeLikePattern(filters.search)}%`,
      (p) =>
        `(${MACHINE_LABEL_SQL} ILIKE ${p} OR m.serial_number ILIKE ${p}
          OR m.registration_number ILIKE ${p} OR mf.name ILIKE ${p}
          OR mm.name ILIKE ${p} OR m.site ILIKE ${p})`,
    );
  }
  return { where: conditions.join(' AND '), params };
};

export const listMachines = async (
  client: PoolClient,
  scope: FleetScope,
  filters: ListMachinesQueryDto,
): Promise<FleetMachineRow[]> => {
  const { where, params } = buildFilter(scope, filters);
  const { limit, offset } = toLimitOffset(filters);
  const result = await client.query<FleetMachineRow>(
    `SELECT ${FLEET_COLUMNS} ${FLEET_FROM} WHERE ${where}
     ORDER BY label, m.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return result.rows;
};

export const countMachines = async (
  client: PoolClient,
  scope: FleetScope,
  filters: ListMachinesQueryDto,
): Promise<number> => {
  const { where, params } = buildFilter(scope, filters);
  const result = await client.query<{ count: string }>(
    `SELECT count(*) ${FLEET_FROM} WHERE ${where}`,
    params,
  );
  return Number(result.rows[0].count);
};

export const findFleetMachine = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  scope: MachineScope,
): Promise<FleetMachineRow | null> => {
  const result = await client.query<FleetMachineRow>(
    `SELECT ${FLEET_COLUMNS} ${FLEET_FROM}
     WHERE m.id = $2 AND m.deleted_at IS NULL
       AND ${visibleMachineSql('m', '$1', scope)}`,
    [tenantId, machineId],
  );
  return result.rows[0] ?? null;
};

// The down machine most worth flagging: one with the most urgent open
// case first (P1 before P2…), then the most recently changed.
export const findFeaturedDownMachine = async (
  client: PoolClient,
  tenantId: string,
  scope: MachineScope,
): Promise<FeaturedDownRow | null> => {
  const result = await client.query<FeaturedDownRow>(
    `SELECT ${FLEET_COLUMNS},
            c.case_number, c.subject AS case_subject, c.priority AS case_priority
     ${FLEET_FROM}
     LEFT JOIN LATERAL (
       SELECT sc.case_number, sc.subject, sc.priority FROM support_cases sc
       WHERE sc.tenant_id = m.tenant_id AND sc.machine_id = m.id AND sc.deleted_at IS NULL
         AND sc.status IN ('new', 'open', 'waiting_on_customer')
       ORDER BY sc.priority, sc.updated_at DESC LIMIT 1
     ) c ON true
     WHERE m.deleted_at IS NULL AND m.status = 'down'
       AND ${visibleMachineSql('m', '$1', scope)}
     ORDER BY c.case_number IS NULL, c.priority, m.updated_at DESC
     LIMIT 1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
};

// The previous status, or null when there's no such machine of the
// organisation in scope (a shared machine's status is its owner's to set).
export const updateMachineStatus = async (
  client: PoolClient,
  params: {
    tenantId: string;
    machineId: string;
    status: OperatingStatus;
    scope: MachineScope;
  },
): Promise<OperatingStatus | null> => {
  const result = await client.query<{ previous_status: OperatingStatus }>(
    `UPDATE machines m SET status = $3
     FROM machines previous
     WHERE m.id = $1 AND m.deleted_at IS NULL AND previous.id = m.id
       AND ${ownMachineSql('m', '$2', params.scope)}
     RETURNING previous.status AS previous_status`,
    [params.machineId, params.tenantId, params.status],
  );
  return result.rows[0]?.previous_status ?? null;
};
