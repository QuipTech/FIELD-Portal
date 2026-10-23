import { PoolClient } from 'pg';
import { toLimitOffset } from '../../common/dto/paginationQueryDto';
import { KnowledgeAccess } from '../access/knowledgeAccess';
import {
  CATALOG_COLUMNS,
  CATALOG_CTE,
  CATALOG_JOINS,
  buildCatalogConditions,
  toWhereClause,
} from '../catalogScope';
import { ForMyMachinesQueryDto } from '../dto/forMyMachinesQueryDto';
import {
  CatalogDocumentRow,
  CountedCatalogDocumentRow,
} from '../types/catalogRows';

const RECENT_LIMIT = 20;

export interface RecentDocumentRow extends CatalogDocumentRow {
  last_page: number | null;
  viewed_at: Date;
}

export interface MatchedMachine {
  id: string;
  serialNumber: string;
  fleetNumber: string | null;
  model: string;
}

export interface MachineDocumentRow extends CountedCatalogDocumentRow {
  matched_machines: MatchedMachine[];
}

// The documents the caller can read right now (live, active brand).
const withReadable = (access: KnowledgeAccess, params: unknown[]): string =>
  `WITH ${CATALOG_CTE}, scoped AS (SELECT c.* FROM catalog c ${toWhereClause(
    buildCatalogConditions(access, {}, params, { readableOnly: true }),
  )})`;

// Run inside withActor(caller).

export const findLastViewedPage = async (
  client: PoolClient,
  userId: string,
  itemId: string,
): Promise<number | null> => {
  const result = await client.query<{ last_page: number | null }>(
    `SELECT last_page FROM knowledge_recent_views
     WHERE user_id = $1 AND knowledge_item_id = $2`,
    [userId, itemId],
  );
  return result.rows[0]?.last_page ?? null;
};

// Opening without a page keeps the page saved earlier.
export const upsertRecentView = async (
  client: PoolClient,
  view: {
    tenantId: string;
    userId: string;
    itemId: string;
    page: number | null;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO knowledge_recent_views (tenant_id, user_id, knowledge_item_id, last_page)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, knowledge_item_id) DO UPDATE
       SET last_page = COALESCE(EXCLUDED.last_page, knowledge_recent_views.last_page),
           viewed_at = now()`,
    [view.tenantId, view.userId, view.itemId, view.page],
  );
};

export const listRecentDocuments = async (
  client: PoolClient,
  access: KnowledgeAccess,
): Promise<RecentDocumentRow[]> => {
  const params: unknown[] = [access.tenantId];
  const readable = withReadable(access, params);
  params.push(access.userId);
  const result = await client.query<RecentDocumentRow>(
    `${readable}
     SELECT ${CATALOG_COLUMNS}, rv.last_page, rv.viewed_at
     FROM knowledge_recent_views rv
     JOIN scoped c ON c.id = rv.knowledge_item_id
     ${CATALOG_JOINS}
     WHERE rv.user_id = $${params.length}
     ORDER BY rv.viewed_at DESC LIMIT ${RECENT_LIMIT}`,
    params,
  );
  return result.rows;
};

// Documents linked to the models of the caller's machines, each with the
// machines it matched: one machine when machineId is given; otherwise the
// machines they're assigned to, or the whole fleet when they have none.
export const listDocumentsForMachines = async (
  client: PoolClient,
  access: KnowledgeAccess,
  query: ForMyMachinesQueryDto,
): Promise<MachineDocumentRow[]> => {
  const params: unknown[] = [access.tenantId];
  const readable = withReadable(access, params);
  params.push(query.machineId ?? null, access.userId);
  const machineParam = `$${params.length - 1}::uuid`;
  const userParam = `$${params.length}::uuid`;
  const { limit, offset } = toLimitOffset(query);
  params.push(limit, offset);
  const result = await client.query<MachineDocumentRow>(
    `${readable},
     fleet AS (
       SELECT m.id, m.serial_number, m.fleet_number, m.model_id,
              mf.name || ' ' || mm.name AS model_name
       FROM machines m
       JOIN machine_models mm ON mm.id = m.model_id
       JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
       WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
         AND (${machineParam} IS NOT NULL AND m.id = ${machineParam}
              OR ${machineParam} IS NULL AND (
                NOT EXISTS (SELECT 1 FROM machine_assignments a
                            WHERE a.tenant_id = $1 AND a.user_id = ${userParam})
                OR EXISTS (SELECT 1 FROM machine_assignments a
                           WHERE a.machine_id = m.id AND a.user_id = ${userParam})))
     ),
     matches AS (
       SELECT km.knowledge_item_id,
              jsonb_agg(DISTINCT jsonb_build_object(
                'id', f.id, 'serialNumber', f.serial_number,
                'fleetNumber', f.fleet_number, 'model', f.model_name)) AS machines
       FROM fleet f
       JOIN knowledge_item_machine_models km ON km.machine_model_id = f.model_id
       GROUP BY km.knowledge_item_id
     )
     SELECT ${CATALOG_COLUMNS}, mt.machines AS matched_machines,
            count(*) OVER () AS total_count
     FROM scoped c
     JOIN matches mt ON mt.knowledge_item_id = c.id
     ${CATALOG_JOINS}
     ORDER BY c.updated_at DESC, c.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows;
};
