import { PoolClient } from 'pg';
import { ComponentRow, SystemRow } from './types/machineConfigurationRows';

// Every query filters on tenant_id explicitly as well as relying on RLS,
// since the backend's database role may bypass RLS.

// Copies the model's systems/components (Machine library) onto a machine
// that has none yet, so systems added to the model after the machine was
// registered still reach it. A no-op once the machine has any.
export const seedInstalledConfiguration = async (client: PoolClient, machineId: string): Promise<void> => {
  await client.query('SELECT seed_installed_configuration($1)', [machineId]);
};

export const listSystems = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<SystemRow[]> => {
  const result = await client.query<SystemRow>(
    `SELECT s.id, s.name
     FROM installed_systems s
     WHERE s.machine_id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL
     ORDER BY s.sort_order, s.name`,
    [machineId, tenantId],
  );
  return result.rows;
};

// systemId / componentId null = no filter on it.
export const listComponents = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; systemId: string | null; componentId?: string },
): Promise<ComponentRow[]> => {
  const result = await client.query<ComponentRow>(
    `SELECT c.id, s.id AS system_id, s.name AS system_name, c.name,
            c.serial_number, c.firmware_version, c.part_number, c.manufacturer,
            c.condition_note, c.condition_severity, c.installed_at, c.hours_at_install,
            c.next_service_due_hours, c.notes, m.operating_hours AS machine_operating_hours,
            last_entry.entry_type AS last_entry_type, last_entry.created_at AS last_entry_at,
            last_service.created_at AS last_serviced_at
     FROM installed_components c
     JOIN installed_systems s ON s.id = c.installed_system_id
     JOIN machines m ON m.id = s.machine_id
     LEFT JOIN LATERAL (
       SELECT max(e.created_at) AS created_at
       FROM technical_history_entries e
       WHERE e.installed_component_id = c.id AND e.tenant_id = $2 AND e.deleted_at IS NULL
         AND e.entry_type IN ('service', 'repair')
     ) last_service ON true
     LEFT JOIN LATERAL (
       SELECT e.entry_type, e.created_at
       FROM technical_history_entries e
       WHERE e.installed_component_id = c.id AND e.tenant_id = $2 AND e.deleted_at IS NULL
       ORDER BY e.created_at DESC
       LIMIT 1
     ) last_entry ON true
     WHERE s.machine_id = $1 AND s.tenant_id = $2
       AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       AND ($3::uuid IS NULL OR s.id = $3::uuid)
       AND ($4::uuid IS NULL OR c.id = $4::uuid)
     ORDER BY s.sort_order, s.name, c.sort_order, c.name`,
    [params.machineId, params.tenantId, params.systemId, params.componentId ?? null],
  );
  return result.rows;
};

export const componentBelongsToMachine = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; componentId: string },
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1
     FROM installed_components c
     JOIN installed_systems s ON s.id = c.installed_system_id
     WHERE c.id = $1 AND s.machine_id = $2 AND c.tenant_id = $3
       AND c.deleted_at IS NULL AND s.deleted_at IS NULL`,
    [params.componentId, params.machineId, params.tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};
