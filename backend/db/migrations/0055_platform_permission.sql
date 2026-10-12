-- Section 1j: the platform administrator level. `platform.manage` lets
-- its holder see and manage every organisation in the admin portal (all
-- users, audit log, AI usage, subscriptions, the shared knowledge and
-- machine libraries, system roles). Only the Owner role holds it — a
-- trigger refuses it on any other role — and self-serve signups get
-- Customer, so Owner is only ever granted deliberately.

INSERT INTO permissions (code, description) VALUES
  ('platform.manage', 'Manage the whole platform, across every organisation (Owner)')
ON CONFLICT (code) DO NOTHING;

-- The guard comes first, so it governs the grants below too.
CREATE OR REPLACE FUNCTION guard_platform_permission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM permissions WHERE id = NEW.permission_id AND code = 'platform.manage')
     AND NOT EXISTS (
       SELECT 1 FROM roles
       WHERE id = NEW.role_id AND name = 'Owner' AND is_system_role AND tenant_id IS NULL
     ) THEN
    RAISE EXCEPTION 'platform.manage can only be held by the Owner role'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_role_permissions_guard_platform ON role_permissions;
CREATE TRIGGER trg_role_permissions_guard_platform
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION guard_platform_permission();

-- Owner holds every permission, platform.manage included.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Owner' AND r.is_system_role AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

-- No other role may hold platform.manage (removes any earlier grant).
DELETE FROM role_permissions rp
USING permissions p, roles r
WHERE rp.permission_id = p.id AND p.code = 'platform.manage'
  AND r.id = rp.role_id
  AND NOT (r.name = 'Owner' AND r.is_system_role AND r.tenant_id IS NULL);

INSERT INTO schema_migrations (version)
VALUES ('0055_platform_permission')
ON CONFLICT (version) DO NOTHING;
