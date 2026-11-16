-- Machine Control access: the platform administrator turns the module on per
-- organisation, and five permissions decide what each person may do in it.
--   mc.view            see Machine Control: devices, sites, files, deliveries
--   mc.upload          upload design files
--   mc.deliver         send files to machines, retry, recall, roll back
--   mc.manage_devices  connect and disconnect machine tablets
--   mc.remote          remote support on a tablet (later)
-- Owner and Organisation Admin get all five. Customer (every self-serve
-- signup) gets all but remote, as do Technical Managers except devices; Field
-- Technicians see it. Off by default: nobody sees the module until it's on.

INSERT INTO permissions (code, description) VALUES
  ('mc.view', 'See Machine Control: devices, sites, files and deliveries'),
  ('mc.upload', 'Upload design files to Machine Control'),
  ('mc.deliver', 'Send files to machines, retry, recall and roll back'),
  ('mc.manage_devices', 'Connect and disconnect machine tablets'),
  ('mc.remote', 'Use remote support on a machine tablet')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM (VALUES
  ('Owner', ARRAY['mc.view', 'mc.upload', 'mc.deliver', 'mc.manage_devices', 'mc.remote']),
  ('Organisation Admin', ARRAY['mc.view', 'mc.upload', 'mc.deliver', 'mc.manage_devices', 'mc.remote']),
  ('Customer', ARRAY['mc.view', 'mc.upload', 'mc.deliver', 'mc.manage_devices']),
  ('Technical Manager', ARRAY['mc.view', 'mc.upload', 'mc.deliver']),
  ('Field Technician', ARRAY['mc.view'])
) AS grants (role_name, codes)
JOIN roles r ON r.name = grants.role_name AND r.is_system_role AND r.tenant_id IS NULL AND r.deleted_at IS NULL
JOIN permissions p ON p.code = ANY (grants.codes)
ON CONFLICT DO NOTHING;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS machine_control_enabled boolean NOT NULL DEFAULT false;

-- Every organisation with whether Machine Control is on and how many tablets
-- are connected, for the platform administrator's switch page.
CREATE OR REPLACE FUNCTION admin_list_machine_control_organisations(p_search text)
RETURNS TABLE (id uuid, name varchar, machine_control_enabled boolean,
               active_machine_count integer, connected_device_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM assert_platform_admin();
  RETURN QUERY
  SELECT t.id, t.name, t.machine_control_enabled,
    (SELECT count(*)::int FROM machines m
     WHERE m.tenant_id = t.id AND m.deleted_at IS NULL AND m.lifecycle_state = 'active'),
    (SELECT count(*)::int FROM mc_devices d
     WHERE d.tenant_id = t.id AND d.disabled_at IS NULL AND d.deleted_at IS NULL)
  FROM tenants t
  WHERE t.deleted_at IS NULL
    AND (coalesce(p_search, '') = '' OR t.name ILIKE '%' || p_search || '%')
  ORDER BY t.machine_control_enabled DESC, t.name;
END
$$;

-- Turns the module on or off. Off also cancels codes still waiting, so no new
-- tablet can pair. Returns the organisation's name, or NULL if there's none.
CREATE OR REPLACE FUNCTION admin_set_machine_control(p_tenant_id uuid, p_enabled boolean)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name varchar;
BEGIN
  PERFORM assert_platform_admin();
  UPDATE tenants SET machine_control_enabled = p_enabled
  WHERE id = p_tenant_id AND deleted_at IS NULL
  RETURNING name INTO v_name;
  IF v_name IS NOT NULL AND NOT p_enabled THEN
    UPDATE mc_pairing_codes SET revoked_at = now()
    WHERE tenant_id = p_tenant_id AND used_at IS NULL AND revoked_at IS NULL;
  END IF;
  RETURN v_name;
END
$$;

REVOKE ALL ON FUNCTION admin_list_machine_control_organisations(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_set_machine_control(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_machine_control_organisations(text) TO field_app;
GRANT EXECUTE ON FUNCTION admin_set_machine_control(uuid, boolean) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0129_machine_control_access')
ON CONFLICT (version) DO NOTHING;
