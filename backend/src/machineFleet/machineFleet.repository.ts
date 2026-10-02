import { PoolClient } from 'pg';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { FeaturedDownRow, FleetMachineRow } from './types/machineFleetRows';
import { OperatingStatus } from './types/machineFleetResponse';

const PAGE_LIMIT = 200;

// Every query filters on tenant_id itself: the backend's database role may
// bypass RLS.
export const MACHINE_LABEL_SQL = `COALESCE(NULLIF(m.asset_number, ''), NULLIF(m.fleet_number, ''), m.serial_number)`;

export const FLEET_COLUMNS = `
  m.id, ${MACHINE_LABEL_SQL} AS label, m.serial_number,
  mf.name AS manufacturer_name, mm.name AS model_name, mm.product_family,
  m.site, m.operating_hours, m.status`;

export const FLEET_FROM = `
  FROM machines m
  JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
  JOIN machine_models mm ON mm.id = m.model_id`;

// WHERE clause and its parameters for the list's filters ($1 = tenant).
const buildFilter = (tenantId: string, filters: ListMachinesQueryDto) => {
  const params: unknown[] = [tenantId];
  const conditions = ['m.tenant_id = $1', 'm.deleted_at IS NULL'];
  const addCondition = (value: unknown, toSql: (param: string) => string) => {
    params.push(value);
    conditions.push(toSql(`$${params.length}`));
  };
  if (filters.site) addCondition(filters.site, (p) => `m.site = ${p}`);
  if (filters.make)
    addCondition(filters.make, (p) => `m.manufacturer_id = ${p}`);
  if (filters.status) addCondition(filters.status, (p) => `m.status = ${p}`);
  if (filters.machineClass) {
    addCondition(
      filters.machineClass,
      (p) => `lower(mm.product_family) = lower(${p})`,
    );
  }
  if (filters.search) {
    addCondition(
      `%${escapeLikePattern(filters.search)}%`,
      (p) =>
        `(${MACHINE_LABEL_SQL} ILIKE ${p} OR m.serial_number ILIKE ${p} OR mf.name ILIKE ${p}
          OR mm.name ILIKE ${p} OR m.site ILIKE ${p})`,
    );
  }
  return { where: conditions.join(' AND '), params };
};

export const listMachines = async (
  client: PoolClient,
  tenantId: string,
  filters: ListMachinesQueryDto,
): Promise<FleetMachineRow[]> => {
  const { where, params } = buildFilter(tenantId, filters);
  const result = await client.query<FleetMachineRow>(
    `SELECT ${FLEET_COLUMNS} ${FLEET_FROM} WHERE ${where}
     ORDER BY label LIMIT ${PAGE_LIMIT}`,
    params,
  );
  return result.rows;
};

export const countMachines = async (
  client: PoolClient,
  tenantId: string,
  filters: ListMachinesQueryDto,
): Promise<number> => {
  const { where, params } = buildFilter(tenantId, filters);
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
): Promise<FleetMachineRow | null> => {
  const result = await client.query<FleetMachineRow>(
    `SELECT ${FLEET_COLUMNS} ${FLEET_FROM}
     WHERE m.tenant_id = $1 AND m.id = $2 AND m.deleted_at IS NULL`,
    [tenantId, machineId],
  );
  return result.rows[0] ?? null;
};

// The down machine most worth flagging: one with the most urgent open
// case first (P1 before P2…), then the most recently changed.
export const findFeaturedDownMachine = async (
  client: PoolClient,
  tenantId: string,
): Promise<FeaturedDownRow | null> => {
  const result = await client.query<FeaturedDownRow>(
    `SELECT ${FLEET_COLUMNS},
            c.case_number, c.subject AS case_subject, c.priority AS case_priority
     ${FLEET_FROM}
     LEFT JOIN LATERAL (
       SELECT sc.case_number, sc.subject, sc.priority FROM support_cases sc
       WHERE sc.tenant_id = $1 AND sc.machine_id = m.id AND sc.deleted_at IS NULL
         AND sc.status IN ('open', 'in_progress')
       ORDER BY sc.priority, sc.updated_at DESC LIMIT 1
     ) c ON true
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL AND m.status = 'down'
     ORDER BY c.case_number IS NULL, c.priority, m.updated_at DESC
     LIMIT 1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
};

// The previous status, or null when there's no such machine.
export const updateMachineStatus = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; status: OperatingStatus },
): Promise<OperatingStatus | null> => {
  const result = await client.query<{ previous_status: OperatingStatus }>(
    `UPDATE machines m SET status = $3
     FROM machines previous
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL
       AND previous.id = m.id
     RETURNING previous.status AS previous_status`,
    [params.machineId, params.tenantId, params.status],
  );
  return result.rows[0]?.previous_status ?? null;
};
