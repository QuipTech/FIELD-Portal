-- Section 1l: organisation-scoped admin data. Every admin screen works at
-- two levels: an organisation admin would see and manage their own
-- organisation's data, a platform admin (Owner, 0055) everyone's. As in 0056, p_tenant_id
-- is the caller's organisation, or NULL for a platform admin (decided only by
-- the backend's resolveAdminScope).
--   * Machine library: organisation-private models next to the shared
--     catalog (machine_models.tenant_id; NULL = shared).
--   * Knowledge: the upload functions also create an organisation's own
--     documents, not just shared-library ones.
--   * Roles: organisation-specific roles (roles.tenant_id) next to the
--     system roles. They may not reuse a system role's name: role names
--     gate access (Owner, Customer), so a look-alike must be impossible.

-- ── Machine library ────────────────────────────────────────────────────
ALTER TABLE machine_models ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_machine_models_tenant_id ON machine_models(tenant_id);

-- Names are unique per manufacturer within the shared catalog and within
-- each organisation's own models.
DROP INDEX IF EXISTS uq_machine_models_live_name;
CREATE UNIQUE INDEX uq_machine_models_live_name
  ON machine_models (manufacturer_id, lower(name),
                     COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS admin_list_machine_models(varchar, uuid);

-- Organisation admin: shared + own models, asset counts for their own machines.
-- Platform admin: every model, asset counts across the platform.
CREATE OR REPLACE FUNCTION admin_list_machine_models(
  p_tenant_id  uuid,
  p_search     varchar DEFAULT NULL,
  p_model_id   uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, manufacturer_name varchar, name varchar, product_family varchar,
  tenant_id uuid, organisation_name varchar, systems_count bigint,
  assets_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT mm.id, mf.name, mm.name, mm.product_family, mm.tenant_id, t.name,
         (SELECT count(*) FROM model_systems ms
           WHERE ms.machine_model_id = mm.id AND ms.deleted_at IS NULL),
         (SELECT count(*) FROM machines m
           WHERE m.model_id = mm.id AND m.deleted_at IS NULL
             AND (p_tenant_id IS NULL OR m.tenant_id = p_tenant_id))
  FROM machine_models mm
  JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
  LEFT JOIN tenants t ON t.id = mm.tenant_id
  WHERE mm.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR mm.tenant_id IS NULL OR mm.tenant_id = p_tenant_id)
    AND (p_model_id IS NULL OR mm.id = p_model_id)
    AND (p_search IS NULL
         OR (mf.name || ' ' || mm.name) ILIKE '%' || p_search || '%'
         OR mm.product_family ILIKE '%' || p_search || '%')
  ORDER BY mf.name, mm.name;
$$;

-- ── Knowledge uploads ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_create_knowledge_upload(uuid, uuid, uuid, varchar, varchar, uuid, varchar, varchar, bigint, varchar, varchar);

-- p_tenant_id NULL → a shared-library document; otherwise that
-- organisation's own document (its key must sit under its own folder).
CREATE OR REPLACE FUNCTION admin_create_knowledge_upload(
  p_tenant_id uuid, p_item_id uuid, p_document_id uuid, p_version_id uuid,
  p_title varchar, p_type varchar, p_user_id uuid, p_file_name varchar,
  p_content_type varchar, p_size_bytes bigint, p_bucket varchar, p_key varchar
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO knowledge_items (id, tenant_id, title, type, status, source_type, created_by)
  VALUES (p_item_id, p_tenant_id, p_title, p_type, 'draft', 'internal', p_user_id);

  INSERT INTO documents (id, tenant_id, knowledge_item_id)
  VALUES (p_document_id, p_tenant_id, p_item_id);

  INSERT INTO document_versions (
    id, tenant_id, document_id, file_url, version_number, uploaded_by,
    ingestion_status, storage_bucket, storage_key, file_name, content_type,
    size_bytes
  )
  VALUES (
    p_version_id, p_tenant_id, p_document_id, 's3://' || p_bucket || '/' || p_key, 1,
    p_user_id, 'uploading', p_bucket, p_key, p_file_name, p_content_type,
    p_size_bytes
  );
END;
$$;

-- 'uploading' → 'pending' or 'failed', for shared and organisation
-- documents alike (the backend checks the caller may manage it first).
CREATE OR REPLACE FUNCTION admin_finish_knowledge_upload(
  p_version_id  uuid,
  p_succeeded   boolean
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH updated AS (
    UPDATE document_versions
    SET ingestion_status = CASE WHEN p_succeeded THEN 'pending' ELSE 'failed' END
    WHERE id = p_version_id AND ingestion_status = 'uploading'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- ── Roles ──────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_name
  ON roles (tenant_id, lower(name))
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;

-- An organisation role can't take a system role's name (Owner, Super
-- Admin…), since role names grant access. Reported as a unique violation
-- so the API answers 409 like any other duplicate name.
CREATE OR REPLACE FUNCTION guard_organisation_role_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM roles r
    WHERE r.tenant_id IS NULL AND r.deleted_at IS NULL AND lower(r.name) = lower(NEW.name)
  ) THEN
    RAISE EXCEPTION 'A system role is already called %', NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_roles_guard_organisation_name ON roles;
CREATE TRIGGER trg_roles_guard_organisation_name
  BEFORE INSERT OR UPDATE OF name, tenant_id, deleted_at ON roles
  FOR EACH ROW EXECUTE FUNCTION guard_organisation_role_name();

DROP FUNCTION IF EXISTS admin_list_roles(uuid);
DROP FUNCTION IF EXISTS admin_create_role(varchar, varchar[]);
DROP FUNCTION IF EXISTS admin_update_role(uuid, varchar, varchar[]);
DROP FUNCTION IF EXISTS admin_delete_role(uuid);

-- System roles plus the organisation's own (p_tenant_id), or every
-- organisation's (NULL). user_count only counts users the caller can see.
CREATE OR REPLACE FUNCTION admin_list_roles(p_tenant_id uuid, p_role_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, name varchar, tenant_id uuid, organisation_name varchar,
  user_count bigint, permission_codes varchar[]
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT r.id, r.name, r.tenant_id, t.name,
         (SELECT count(*) FROM user_roles ur
            JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
           WHERE ur.role_id = r.id
             AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)),
         COALESCE(
           (SELECT array_agg(p.code ORDER BY p.code)
              FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id),
           '{}'::varchar[])
  FROM roles r
  LEFT JOIN tenants t ON t.id = r.tenant_id
  WHERE r.deleted_at IS NULL
    AND ((r.tenant_id IS NULL AND r.is_system_role)
         OR p_tenant_id IS NULL OR r.tenant_id = p_tenant_id)
    AND (p_role_id IS NULL OR r.id = p_role_id)
  ORDER BY r.tenant_id IS NOT NULL, t.name, r.name;
$$;

-- p_tenant_id NULL creates a system role; otherwise that organisation's.
CREATE OR REPLACE FUNCTION admin_create_role(
  p_tenant_id uuid, p_name varchar, p_permission_codes varchar[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  INSERT INTO roles (name, is_system_role, tenant_id)
  VALUES (p_name, p_tenant_id IS NULL, p_tenant_id)
  RETURNING id INTO v_role_id;

  INSERT INTO role_permissions (role_id, permission_id, tenant_id)
  SELECT v_role_id, p.id, p_tenant_id
  FROM permissions p
  WHERE p.code = ANY (p_permission_codes);

  RETURN v_role_id;
END;
$$;

-- An organisation admin (p_tenant_id) may change only their organisation's roles; a
-- Platform admin (NULL) any role. False when there's no such role in scope.
CREATE OR REPLACE FUNCTION admin_update_role(
  p_tenant_id uuid, p_role_id uuid, p_name varchar, p_permission_codes varchar[]
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_role_tenant FROM roles
  WHERE id = p_role_id AND deleted_at IS NULL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_name IS NOT NULL THEN
    UPDATE roles SET name = p_name WHERE id = p_role_id;
  END IF;

  IF p_permission_codes IS NOT NULL THEN
    DELETE FROM role_permissions WHERE role_id = p_role_id;
    INSERT INTO role_permissions (role_id, permission_id, tenant_id)
    SELECT p_role_id, p.id, v_role_tenant
    FROM permissions p
    WHERE p.code = ANY (p_permission_codes);
  END IF;

  RETURN true;
END;
$$;

-- Soft delete: 'deleted', 'not_found' (none in scope) or 'in_use'.
CREATE OR REPLACE FUNCTION admin_delete_role(p_tenant_id uuid, p_role_id uuid)
RETURNS varchar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM roles
  WHERE id = p_role_id AND deleted_at IS NULL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
    WHERE ur.role_id = p_role_id
  ) THEN
    RETURN 'in_use';
  END IF;

  UPDATE roles SET deleted_at = now() WHERE id = p_role_id;
  RETURN 'deleted';
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'admin_list_machine_models(uuid, varchar, uuid)',
    'admin_create_knowledge_upload(uuid, uuid, uuid, uuid, varchar, varchar, uuid, varchar, varchar, bigint, varchar, varchar)',
    'admin_finish_knowledge_upload(uuid, boolean)',
    'admin_list_roles(uuid, uuid)',
    'admin_create_role(uuid, varchar, varchar[])',
    'admin_update_role(uuid, uuid, varchar, varchar[])',
    'admin_delete_role(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO field_app', v_signature);
  END LOOP;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0057_organisation_admin_data')
ON CONFLICT (version) DO NOTHING;
