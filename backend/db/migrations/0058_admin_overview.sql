-- Section 1m: the admin portal's Overview page. Like 0056/0057, each
-- function takes p_tenant_id: the organisation admin's organisation, or NULL for a
-- Platform admin (decided only by the backend's resolveAdminScope).
-- SECURITY DEFINER because a platform admin's figures span every
-- organisation, which RLS would hide.

-- The three stat cards and the header.
--   Users: active vs invited (not signed in yet).
--   Documents: what the organisation's technicians can search — its own
--   documents plus the shared library (every document for a platform admin);
--   "indexed" = has a live version; pages compare live vs latest uploads.
--   Assets: registered machines, the models they use, and their sites.
CREATE OR REPLACE FUNCTION admin_overview_summary(p_tenant_id uuid)
RETURNS TABLE (
  active_users      bigint,
  invited_users     bigint,
  documents_indexed bigint,
  pages_total       bigint,
  pages_searchable  bigint,
  assets            bigint,
  models_in_use     bigint,
  sites             bigint,
  organisations     bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH scoped_users AS (
    SELECT status FROM users
    WHERE deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  ),
  scoped_documents AS (
    SELECT d.live_version_id,
           (SELECT v.page_count FROM document_versions v
             WHERE v.document_id = d.id ORDER BY v.version_number DESC LIMIT 1) AS latest_pages,
           (SELECT v.page_count FROM document_versions v
             WHERE v.id = d.live_version_id) AS live_pages
    FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
    WHERE ki.deleted_at IS NULL AND ki.status <> 'archived'
      AND (p_tenant_id IS NULL OR ki.tenant_id IS NULL OR ki.tenant_id = p_tenant_id)
  ),
  scoped_machines AS (
    SELECT model_id, NULLIF(trim(site), '') AS site FROM machines
    WHERE deleted_at IS NULL AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  )
  SELECT
    (SELECT count(*) FROM scoped_users WHERE status = 'active'),
    (SELECT count(*) FROM scoped_users WHERE status = 'invited'),
    (SELECT count(*) FROM scoped_documents WHERE live_version_id IS NOT NULL),
    (SELECT COALESCE(sum(latest_pages), 0) FROM scoped_documents),
    (SELECT COALESCE(sum(live_pages), 0) FROM scoped_documents WHERE live_version_id IS NOT NULL),
    (SELECT count(*) FROM scoped_machines),
    (SELECT count(DISTINCT model_id) FROM scoped_machines),
    (SELECT count(DISTINCT site) FROM scoped_machines),
    (SELECT count(*) FROM tenants WHERE p_tenant_id IS NULL OR id = p_tenant_id);
$$;

-- Documents that still need something: indexing now, queued, failed, or
-- waiting for review. An organisation admin sees their organisation's documents (they
-- can't act on the shared library); a platform admin every document.
-- queue_position counts across the whole platform, since one worker
-- serves every organisation.
CREATE OR REPLACE FUNCTION admin_overview_ingestion_queue(p_tenant_id uuid, p_limit integer)
RETURNS TABLE (
  item_id            uuid,
  title              varchar,
  organisation_name  varchar,
  item_status        varchar,
  ingestion_status   varchar,
  progress           smallint,
  page_count         integer,
  error_message      text,
  queue_position     bigint,
  uploaded_by_name   varchar,
  uploaded_at        timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (d.id)
           ki.id AS item_id, ki.title, ki.tenant_id, ki.status AS item_status,
           v.ingestion_status, v.indexing_progress, v.page_count, v.error_message,
           v.uploaded_by, v.created_at
    FROM knowledge_items ki
    JOIN documents d ON d.knowledge_item_id = ki.id AND d.deleted_at IS NULL
    JOIN document_versions v ON v.document_id = d.id
    WHERE ki.deleted_at IS NULL AND ki.status <> 'archived'
    ORDER BY d.id, v.version_number DESC
  ),
  queued AS (
    SELECT item_id, row_number() OVER (ORDER BY created_at) AS queue_position
    FROM latest WHERE ingestion_status = 'pending'
  ),
  pending_work AS (
    SELECT l.*, q.queue_position,
           CASE
             WHEN l.ingestion_status IN ('parsing', 'chunking', 'embedding') THEN 0
             WHEN l.ingestion_status = 'pending' THEN 1
             WHEN l.ingestion_status = 'failed' THEN 2
             ELSE 3
           END AS sort_group
    FROM latest l
    LEFT JOIN queued q ON q.item_id = l.item_id
    WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND (l.ingestion_status IN ('pending', 'parsing', 'chunking', 'embedding', 'failed')
           OR (l.ingestion_status = 'ready' AND l.item_status = 'review'))
  )
  SELECT p.item_id, p.title, t.name, p.item_status, p.ingestion_status,
         p.indexing_progress, p.page_count, p.error_message, p.queue_position,
         (u.first_name || ' ' || u.last_name)::varchar, p.created_at
  FROM pending_work p
  LEFT JOIN tenants t ON t.id = p.tenant_id
  LEFT JOIN users u ON u.id = p.uploaded_by
  ORDER BY p.sort_group, p.queue_position NULLS LAST, p.created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION admin_overview_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_overview_ingestion_queue(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_overview_summary(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_overview_ingestion_queue(uuid, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0058_admin_overview')
ON CONFLICT (version) DO NOTHING;
