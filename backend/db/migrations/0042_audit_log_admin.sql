-- Section 7b: the admin portal's Audit log page — every organisation's
-- audit events in one list. SECURITY DEFINER like admin_list_users
-- (0028): audit_logs is RLS-scoped per tenant, and the backend's
-- Owner-only guard is what restricts these. Never call them from an
-- unguarded route.

-- Which client made the change: 'web' (the portal) or 'mobile', from the
-- request's X-Field-Client header. NULL on rows written before this
-- column and on background-job rows (which also have no user_id).
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS source varchar CHECK (source IN ('web', 'mobile', 'system'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);

-- NULL filters are skipped; p_from inclusive, p_to exclusive. Rows are
-- paged first, then each page's actor/target names are looked up, so the
-- per-row lookups never run over the whole log. target_name is the
-- entity's current name, NULL once the entity itself is gone.
CREATE OR REPLACE FUNCTION admin_list_audit_logs(
  p_actor_id     uuid DEFAULT NULL,
  p_entity_type  varchar DEFAULT NULL,
  p_action       varchar DEFAULT NULL,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  created_at         timestamptz,
  action             varchar,
  entity_type        varchar,
  entity_id          uuid,
  metadata           jsonb,
  source             varchar,
  actor_id           uuid,
  actor_name         varchar,
  actor_avatar       varchar,
  organisation_name  varchar,
  target_name        varchar,
  total_count        bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH page AS (
    SELECT al.*, count(*) OVER () AS total_count
    FROM audit_logs al
    WHERE (p_actor_id IS NULL OR al.user_id = p_actor_id)
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at < p_to)
    ORDER BY al.created_at DESC, al.id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT p.id, p.created_at, p.action, p.entity_type, p.entity_id, p.metadata,
         COALESCE(p.source, CASE WHEN p.user_id IS NULL THEN 'system' END)::varchar,
         p.user_id,
         (u.first_name || ' ' || u.last_name)::varchar,
         u.avatar_url,
         t.name,
         (CASE p.entity_type
            WHEN 'user' THEN (SELECT x.email FROM users x WHERE x.id = p.entity_id)
            WHEN 'role' THEN (SELECT x.name FROM roles x WHERE x.id = p.entity_id)
            WHEN 'knowledge_item' THEN (SELECT x.title FROM knowledge_items x WHERE x.id = p.entity_id)
            WHEN 'machine_model' THEN (
              SELECT mf.name || ' ' || mm.name FROM machine_models mm
              JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
              WHERE mm.id = p.entity_id)
            WHEN 'model_system' THEN (SELECT x.name FROM model_systems x WHERE x.id = p.entity_id)
            WHEN 'model_component' THEN (SELECT x.name FROM model_components x WHERE x.id = p.entity_id)
            WHEN 'ai_prompt_version' THEN (
              SELECT 'v' || x.version_number FROM ai_prompt_versions x WHERE x.id = p.entity_id)
            WHEN 'technical_history_entry' THEN (
              SELECT COALESCE(m.fleet_number, m.serial_number) FROM technical_history_entries h
              JOIN machines m ON m.id = h.machine_id WHERE h.id = p.entity_id)
            WHEN 'machine_photo' THEN (
              SELECT COALESCE(m.fleet_number, m.serial_number) FROM machines m
              WHERE m.id::text = p.metadata->>'machineId')
          END)::varchar,
         p.total_count
  FROM page p
  JOIN tenants t ON t.id = p.tenant_id
  LEFT JOIN users u ON u.id = p.user_id
  ORDER BY p.created_at DESC, p.id;
$$;

-- Everyone who appears in the log, for the Actor filter.
CREATE OR REPLACE FUNCTION admin_list_audit_actors()
RETURNS TABLE (id uuid, name varchar, organisation_name varchar)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, (u.first_name || ' ' || u.last_name)::varchar, t.name
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE EXISTS (SELECT 1 FROM audit_logs al WHERE al.user_id = u.id)
  ORDER BY 2;
$$;

-- Each entity/action pair that occurs, for the Action filter.
CREATE OR REPLACE FUNCTION admin_list_audit_event_types()
RETURNS TABLE (entity_type varchar, action varchar, event_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT entity_type, action, count(*)
  FROM audit_logs
  GROUP BY entity_type, action
  ORDER BY entity_type, action;
$$;

REVOKE ALL ON FUNCTION admin_list_audit_logs(uuid, varchar, varchar, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_audit_actors() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_audit_event_types() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_audit_logs(uuid, varchar, varchar, timestamptz, timestamptz, integer, integer) TO field_app;
GRANT EXECUTE ON FUNCTION admin_list_audit_actors() TO field_app;
GRANT EXECUTE ON FUNCTION admin_list_audit_event_types() TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0042_audit_log_admin')
ON CONFLICT (version) DO NOTHING;
