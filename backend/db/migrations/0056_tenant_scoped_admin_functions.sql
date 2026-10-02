-- Section 1k: tenant scoping for the admin portal's cross-organisation
-- functions (0028, 0041, 0042). Each now takes p_tenant_id first:
--   * an organisation id → only that organisation's rows (an organisation admin)
--   * NULL → every organisation (a platform admin: platform.manage, held by Owner — 0055)
-- The backend derives p_tenant_id in one place (src/auth/adminScope) and
-- passes NULL only for callers holding platform.manage. The old unscoped
-- signatures are dropped so nothing can call them by mistake; re-running
-- 0028/0041/0042 recreates them, and re-running this file drops them again.

DROP FUNCTION IF EXISTS admin_list_users(varchar, varchar, integer, integer);
DROP FUNCTION IF EXISTS admin_list_audit_logs(uuid, varchar, varchar, timestamptz, timestamptz, integer, integer);
DROP FUNCTION IF EXISTS admin_list_audit_actors();
DROP FUNCTION IF EXISTS admin_list_audit_event_types();
DROP FUNCTION IF EXISTS admin_ai_usage_summary(integer);
DROP FUNCTION IF EXISTS admin_ai_queries_per_day(integer);
DROP FUNCTION IF EXISTS admin_ai_usage_by_organisation(integer, integer);
DROP FUNCTION IF EXISTS admin_list_ai_review_items(varchar, uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS admin_count_ai_review_statuses();
DROP FUNCTION IF EXISTS admin_list_ai_reviewers();
DROP FUNCTION IF EXISTS admin_update_ai_review_item(uuid, varchar, uuid, text);

-- ── Users ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_users(
  p_tenant_id  uuid,
  p_search     varchar,
  p_role       varchar,
  p_limit      integer,
  p_offset     integer
)
RETURNS TABLE (
  id uuid, email varchar, first_name varchar, last_name varchar,
  avatar_url varchar, status varchar, last_login_at timestamptz,
  created_at timestamptz, tenant_id uuid, tenant_name varchar,
  roles varchar[], total_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH user_role_names AS (
    SELECT ur.user_id, array_agg(r.name ORDER BY r.name) AS roles
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
    GROUP BY ur.user_id
  ),
  matching AS (
    SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.status,
           u.last_login_at, u.created_at, t.id AS tenant_id, t.name AS tenant_name,
           COALESCE(urn.roles, '{}'::varchar[]) AS roles
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    LEFT JOIN user_role_names urn ON urn.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
      AND (
        p_search IS NULL
        OR u.email ILIKE '%' || p_search || '%'
        OR (u.first_name || ' ' || u.last_name) ILIKE '%' || p_search || '%'
        OR t.name ILIKE '%' || p_search || '%'
      )
      AND (p_role IS NULL OR p_role = ANY (COALESCE(urn.roles, '{}'::varchar[])))
  )
  SELECT m.id, m.email, m.first_name, m.last_name, m.avatar_url, m.status,
         m.last_login_at, m.created_at, m.tenant_id, m.tenant_name, m.roles,
         count(*) OVER () AS total_count
  FROM matching m
  ORDER BY m.created_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
$$;

-- ── Audit log ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_audit_logs(
  p_tenant_id    uuid,
  p_actor_id     uuid DEFAULT NULL,
  p_entity_type  varchar DEFAULT NULL,
  p_action       varchar DEFAULT NULL,
  p_from         timestamptz DEFAULT NULL,
  p_to           timestamptz DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, created_at timestamptz, action varchar, entity_type varchar,
  entity_id uuid, metadata jsonb, source varchar, actor_id uuid,
  actor_name varchar, actor_avatar varchar, organisation_name varchar,
  target_name varchar, total_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH page AS (
    SELECT al.*, count(*) OVER () AS total_count
    FROM audit_logs al
    WHERE (p_tenant_id IS NULL OR al.tenant_id = p_tenant_id)
      AND (p_actor_id IS NULL OR al.user_id = p_actor_id)
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

CREATE OR REPLACE FUNCTION admin_list_audit_actors(p_tenant_id uuid)
RETURNS TABLE (id uuid, name varchar, organisation_name varchar)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, (u.first_name || ' ' || u.last_name)::varchar, t.name
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE EXISTS (
    SELECT 1 FROM audit_logs al
    WHERE al.user_id = u.id AND (p_tenant_id IS NULL OR al.tenant_id = p_tenant_id)
  )
  ORDER BY 2;
$$;

CREATE OR REPLACE FUNCTION admin_list_audit_event_types(p_tenant_id uuid)
RETURNS TABLE (entity_type varchar, action varchar, event_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT entity_type, action, count(*)
  FROM audit_logs
  WHERE p_tenant_id IS NULL OR tenant_id = p_tenant_id
  GROUP BY entity_type, action
  ORDER BY entity_type, action;
$$;

-- ── AI usage ───────────────────────────────────────────────────────────
-- A "query" is one technician message to the assistant; prior_queries
-- covers the p_days before the window.
CREATE OR REPLACE FUNCTION admin_ai_usage_summary(p_tenant_id uuid, p_days integer)
RETURNS TABLE (
  total_queries bigint, prior_queries bigint, active_users bigint,
  total_users bigint, total_cost double precision,
  flagged_in_period bigint, unreviewed_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH bounds AS (
    SELECT now() - make_interval(days => p_days) AS since,
           now() - make_interval(days => p_days * 2) AS prior_since
  )
  SELECT
    (SELECT count(*) FROM ai_messages, bounds
      WHERE role = 'user' AND created_at >= since
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)),
    (SELECT count(*) FROM ai_messages, bounds
      WHERE role = 'user' AND created_at >= prior_since AND created_at < since
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)),
    (SELECT count(DISTINCT c.user_id) FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id, bounds
      WHERE m.role = 'user' AND m.created_at >= since
        AND (p_tenant_id IS NULL OR m.tenant_id = p_tenant_id)),
    (SELECT count(*) FROM users
      WHERE deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)),
    (SELECT COALESCE(sum(cost_estimate), 0) FROM ai_usage_log, bounds
      WHERE created_at >= since AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)),
    (SELECT count(*) FROM ai_review_items, bounds
      WHERE created_at >= since AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)),
    (SELECT count(*) FROM ai_review_items
      WHERE status = 'unreviewed' AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id));
$$;

CREATE OR REPLACE FUNCTION admin_ai_queries_per_day(p_tenant_id uuid, p_days integer)
RETURNS TABLE (day date, query_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT d::date,
         (SELECT count(*) FROM ai_messages
           WHERE role = 'user' AND created_at >= d AND created_at < d + interval '1 day'
             AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id))
  FROM generate_series(current_date - (p_days - 1), current_date, interval '1 day') AS d
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION admin_ai_usage_by_organisation(p_tenant_id uuid, p_days integer, p_limit integer)
RETURNS TABLE (tenant_id uuid, organisation_name varchar, query_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT t.id, t.name, count(*)
  FROM ai_messages m
  JOIN tenants t ON t.id = m.tenant_id
  WHERE m.role = 'user' AND m.created_at >= now() - make_interval(days => p_days)
    AND (p_tenant_id IS NULL OR m.tenant_id = p_tenant_id)
  GROUP BY t.id, t.name
  ORDER BY 3 DESC, 2
  LIMIT p_limit;
$$;

-- ── AI review queue ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_ai_review_items(
  p_tenant_id    uuid,
  p_status       varchar DEFAULT NULL,
  p_reviewer_id  uuid DEFAULT NULL,
  p_item_id      uuid DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, tenant_id uuid, organisation_name varchar, question text,
  answer text, reason_code varchar, reason text, notes text, status varchar,
  reviewer_id uuid, reviewer_name varchar, reviewer_avatar varchar,
  flagged_at timestamptz, reviewed_at timestamptz, total_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT ri.id, ri.tenant_id, t.name, q.content, m.content, ri.reason_code,
         ri.reason, ri.notes, ri.status, ri.reviewer_id,
         (ru.first_name || ' ' || ru.last_name)::varchar, ru.avatar_url,
         ri.created_at, ri.reviewed_at, count(*) OVER ()
  FROM ai_review_items ri
  JOIN tenants t ON t.id = ri.tenant_id
  JOIN ai_messages m ON m.id = ri.message_id
  LEFT JOIN LATERAL (
    SELECT um.content FROM ai_messages um
    WHERE um.conversation_id = m.conversation_id AND um.role = 'user'
      AND um.created_at <= m.created_at AND um.id <> m.id
    ORDER BY um.created_at DESC LIMIT 1
  ) q ON true
  LEFT JOIN users ru ON ru.id = ri.reviewer_id
  WHERE (p_tenant_id IS NULL OR ri.tenant_id = p_tenant_id)
    AND (p_status IS NULL OR ri.status = p_status)
    AND (p_reviewer_id IS NULL OR ri.reviewer_id = p_reviewer_id)
    AND (p_item_id IS NULL OR ri.id = p_item_id)
  ORDER BY ri.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION admin_count_ai_review_statuses(p_tenant_id uuid)
RETURNS TABLE (status varchar, item_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT status, count(*) FROM ai_review_items
  WHERE p_tenant_id IS NULL OR tenant_id = p_tenant_id
  GROUP BY status;
$$;

CREATE OR REPLACE FUNCTION admin_list_ai_reviewers(p_tenant_id uuid)
RETURNS TABLE (id uuid, name varchar, avatar_url varchar)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT DISTINCT u.id, (u.first_name || ' ' || u.last_name)::varchar, u.avatar_url
  FROM ai_review_items ri
  JOIN users u ON u.id = ri.reviewer_id
  WHERE p_tenant_id IS NULL OR ri.tenant_id = p_tenant_id
  ORDER BY 2;
$$;

-- Returns the item's tenant_id, or NULL when there's no such item in scope.
CREATE OR REPLACE FUNCTION admin_update_ai_review_item(
  p_tenant_id    uuid,
  p_item_id      uuid,
  p_status       varchar,
  p_reviewer_id  uuid,
  p_notes        text
)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE ai_review_items
  SET status = p_status,
      reviewer_id = p_reviewer_id,
      notes = COALESCE(p_notes, notes),
      reviewed_at = CASE WHEN p_status IN ('resolved', 'escalated') THEN now() ELSE NULL END
  WHERE id = p_item_id AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  RETURNING tenant_id;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'admin_list_users(uuid, varchar, varchar, integer, integer)',
    'admin_list_audit_logs(uuid, uuid, varchar, varchar, timestamptz, timestamptz, integer, integer)',
    'admin_list_audit_actors(uuid)',
    'admin_list_audit_event_types(uuid)',
    'admin_ai_usage_summary(uuid, integer)',
    'admin_ai_queries_per_day(uuid, integer)',
    'admin_ai_usage_by_organisation(uuid, integer, integer)',
    'admin_list_ai_review_items(uuid, varchar, uuid, uuid, integer, integer)',
    'admin_count_ai_review_statuses(uuid)',
    'admin_list_ai_reviewers(uuid)',
    'admin_update_ai_review_item(uuid, uuid, varchar, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO field_app', v_signature);
  END LOOP;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0056_tenant_scoped_admin_functions')
ON CONFLICT (version) DO NOTHING;
