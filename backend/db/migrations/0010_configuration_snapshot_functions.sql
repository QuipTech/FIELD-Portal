-- Section 2e: capture_configuration_snapshot() and
-- diff_configuration_snapshots(), as named in the schema doc. Both run
-- SECURITY INVOKER (the default) — RLS applies normally using whatever
-- tenant context the caller already set via set_config('app.tenant_id', ...).

CREATE OR REPLACE FUNCTION capture_configuration_snapshot(
  p_machine_id  uuid,
  p_taken_by    uuid,
  p_trigger     varchar
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id uuid;
BEGIN
  INSERT INTO configuration_snapshots (tenant_id, machine_id, taken_by, trigger)
  VALUES (current_tenant_id(), p_machine_id, p_taken_by, p_trigger)
  RETURNING id INTO v_snapshot_id;

  INSERT INTO configuration_snapshot_items (
    tenant_id, snapshot_id, system_name, component_name,
    serial_number, firmware_version, software_version
  )
  SELECT current_tenant_id(), v_snapshot_id, s.name, c.name,
         c.serial_number, c.firmware_version, c.software_version
  FROM installed_systems s
  JOIN installed_components c ON c.installed_system_id = s.id
  WHERE s.machine_id = p_machine_id
    AND s.deleted_at IS NULL
    AND c.deleted_at IS NULL;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION diff_configuration_snapshots(
  p_snapshot_id_a  uuid,
  p_snapshot_id_b  uuid
)
RETURNS TABLE (
  system_name     varchar,
  component_name  varchar,
  change_type     varchar,
  field_name      varchar,
  old_value       varchar,
  new_value       varchar
)
LANGUAGE sql
STABLE
AS $$
  WITH a AS (
    SELECT * FROM configuration_snapshot_items WHERE snapshot_id = p_snapshot_id_a
  ),
  b AS (
    SELECT * FROM configuration_snapshot_items WHERE snapshot_id = p_snapshot_id_b
  ),
  matched AS (
    SELECT
      COALESCE(a.system_name, b.system_name) AS system_name,
      COALESCE(a.component_name, b.component_name) AS component_name,
      a.serial_number AS old_serial_number, b.serial_number AS new_serial_number,
      a.firmware_version AS old_firmware_version, b.firmware_version AS new_firmware_version,
      a.software_version AS old_software_version, b.software_version AS new_software_version,
      (a.component_name IS NULL) AS is_added,
      (b.component_name IS NULL) AS is_removed
    FROM a
    FULL OUTER JOIN b
      ON a.system_name = b.system_name AND a.component_name = b.component_name
  )
  SELECT matched.system_name, matched.component_name,
         CASE WHEN is_added THEN 'added' WHEN is_removed THEN 'removed' ELSE 'changed' END,
         fields.field_name, fields.old_value, fields.new_value
  FROM matched
  CROSS JOIN LATERAL (
    VALUES
      ('serial_number', old_serial_number, new_serial_number),
      ('firmware_version', old_firmware_version, new_firmware_version),
      ('software_version', old_software_version, new_software_version)
  ) AS fields(field_name, old_value, new_value)
  WHERE is_added OR is_removed OR old_value IS DISTINCT FROM new_value;
$$;

INSERT INTO schema_migrations (version)
VALUES ('0010_configuration_snapshot_functions')
ON CONFLICT (version) DO NOTHING;
