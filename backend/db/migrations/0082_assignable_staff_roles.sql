-- Support cases can be assigned to anyone holding the Technical Manager,
-- Field Technician, Support Agent or Knowledge Manager role, in any
-- organisation (the admin's decision, 2026-10-13). 0073's rules still
-- apply too: support.agent / platform.manage, or the admin's own
-- organisation. Being staff only opens the cases assigned to that person
-- (caseAccessPolicy); the admin alone sees the whole queue.

CREATE OR REPLACE FUNCTION is_support_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT user_has_permission(p_user_id, 'support.agent')
      OR user_has_permission(p_user_id, 'platform.manage')
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id AND r.is_system_role AND r.deleted_at IS NULL
          AND r.name IN ('Technical Manager', 'Field Technician', 'Support Agent', 'Knowledge Manager')
      )
      OR EXISTS (
        SELECT 1 FROM users me
        JOIN users colleague ON colleague.tenant_id = me.tenant_id
        WHERE me.id = p_user_id AND me.deleted_at IS NULL
          AND colleague.deleted_at IS NULL AND colleague.status = 'active'
          AND user_has_permission(colleague.id, 'platform.manage')
      );
$$;

INSERT INTO schema_migrations (version)
VALUES ('0082_assignable_staff_roles')
ON CONFLICT (version) DO NOTHING;
