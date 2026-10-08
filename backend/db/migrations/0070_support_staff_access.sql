-- Section 5d: QuipTech support staff work cases from every organisation.
--   * support.agent — a support person: works the cases assigned to them.
--     Held by the new "Support Agent" system role and by Owner (who, with
--     platform.manage, is the support admin: every case). A trigger keeps
--     it off every other role, so no organisation can grant itself
--     cross-organisation access.
--   * The functions below and the queue's (0071) are the only
--     cross-organisation reads. Everything else on a case runs under the
--     case's own tenant (RLS), after src/supportCases/caseAccessPolicy.ts
--     has decided the caller may.

INSERT INTO permissions (code, description) VALUES
  ('support.agent', 'Work support cases assigned to you, in any organisation (QuipTech support staff)')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION guard_support_agent_permission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM permissions WHERE id = NEW.permission_id AND code = 'support.agent')
     AND NOT EXISTS (
       SELECT 1 FROM roles
       WHERE id = NEW.role_id AND name IN ('Owner', 'Support Agent')
         AND is_system_role AND tenant_id IS NULL
     ) THEN
    RAISE EXCEPTION 'support.agent can only be held by the Owner and Support Agent roles'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_role_permissions_guard_support_agent ON role_permissions;
CREATE TRIGGER trg_role_permissions_guard_support_agent
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION guard_support_agent_permission();

INSERT INTO roles (name, is_system_role, tenant_id, is_default)
SELECT 'Support Agent', true, NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM roles
  WHERE name = 'Support Agent' AND is_system_role AND tenant_id IS NULL AND deleted_at IS NULL
);

-- Support Agents also raise cases (support.create), like everyone.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code IN ('support.agent', 'support.create')
WHERE r.is_system_role AND r.tenant_id IS NULL AND r.deleted_at IS NULL
  AND r.name IN ('Owner', 'Support Agent')
ON CONFLICT DO NOTHING;

-- ── Who is staff ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id uuid, p_code varchar)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id AND p.code = p_code
    WHERE ur.user_id = p_user_id
  );
$$;

-- A person shown on a case: someone in the case's own organisation, or a
-- support staff member (from QuipTech's). Nobody else, so this can't be
-- used to look up other organisations' users.
CREATE OR REPLACE FUNCTION support_case_person(p_user_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, avatar_storage_key varchar, is_admin boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.tenant_id, u.first_name, u.last_name, u.email,
         u.avatar_url, u.avatar_storage_key,
         user_has_permission(u.id, 'platform.manage')
  FROM users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL
    AND (u.tenant_id = current_tenant_id() OR user_has_permission(u.id, 'support.agent'));
$$;

-- The organisation a case belongs to, so a staff request can then work on
-- it under that organisation's RLS.
CREATE OR REPLACE FUNCTION support_case_tenant_id(p_case_number bigint)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT tenant_id FROM support_cases WHERE case_number = p_case_number AND deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION user_has_permission(uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION support_case_person(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION support_case_tenant_id(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION support_case_person(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION support_case_tenant_id(bigint) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0070_support_staff_access')
ON CONFLICT (version) DO NOTHING;
