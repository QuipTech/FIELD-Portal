-- Section 1b follow-up: a "Customer" system role, now the role every
-- self-serve signup (email/password, Google, Apple) receives instead of
-- Owner. Existing users keep the roles they already have.

-- roles has no unique constraint on name, so ON CONFLICT can't dedupe;
-- NOT EXISTS keeps this migration safe to re-run.
INSERT INTO roles (name, is_system_role, tenant_id)
SELECT 'Customer', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM roles
  WHERE name = 'Customer' AND is_system_role = true AND tenant_id IS NULL
);

-- Starter permission set: the AI assistant only. Grant more here as the
-- customer-facing features land.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code IN ('ai.use')
WHERE r.name = 'Customer' AND r.is_system_role = true AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0027_customer_role')
ON CONFLICT (version) DO NOTHING;
