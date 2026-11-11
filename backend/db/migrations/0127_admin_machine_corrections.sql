-- The platform administrator corrects another organisation's machine: its
-- Plant ID (asset_number), serial and site, from the machine page they see
-- through a shared group. RLS lets an organisation update only its own
-- machines, so this SECURITY DEFINER function checks the caller first
-- (assert_platform_admin, migration 0119) and changes only the fields asked.
-- Customers still never edit another organisation's machine.
--
-- p_changes keys (each optional): serialNumber (never blank), assetNumber
-- and site (null or blank clears). Returns the owning organisation and the
-- values before and after, for the audit entries; null if the machine
-- doesn't exist. A duplicate live serial in the owning organisation raises
-- the usual unique violation (uq_machines_tenant_serial_live).

CREATE OR REPLACE FUNCTION admin_correct_machine(p_machine_id uuid, p_changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before machines%ROWTYPE;
  v_serial varchar;
  v_asset varchar;
  v_site varchar;
BEGIN
  PERFORM assert_platform_admin();

  SELECT * INTO v_before FROM machines
  WHERE id = p_machine_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_serial := v_before.serial_number;
  IF p_changes ? 'serialNumber' THEN
    v_serial := NULLIF(btrim(p_changes->>'serialNumber'), '');
    IF v_serial IS NULL THEN
      RAISE EXCEPTION 'serial number can''t be blank' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_asset := CASE WHEN p_changes ? 'assetNumber'
    THEN NULLIF(btrim(p_changes->>'assetNumber'), '') ELSE v_before.asset_number END;
  v_site := CASE WHEN p_changes ? 'site'
    THEN NULLIF(btrim(p_changes->>'site'), '') ELSE v_before.site END;

  UPDATE machines
  SET serial_number = v_serial, asset_number = v_asset, site = v_site, updated_at = now()
  WHERE id = p_machine_id;

  RETURN jsonb_build_object(
    'tenantId', v_before.tenant_id,
    'before', jsonb_build_object(
      'serialNumber', v_before.serial_number,
      'assetNumber', v_before.asset_number,
      'site', v_before.site),
    'after', jsonb_build_object(
      'serialNumber', v_serial,
      'assetNumber', v_asset,
      'site', v_site),
    'fleetNumber', v_before.fleet_number,
    'registrationNumber', v_before.registration_number);
END
$$;

REVOKE ALL ON FUNCTION admin_correct_machine(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_correct_machine(uuid, jsonb) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0127_admin_machine_corrections')
ON CONFLICT (version) DO NOTHING;
