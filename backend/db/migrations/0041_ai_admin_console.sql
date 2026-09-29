-- Section 4e: the admin portal's AI configuration page — the platform-wide
-- assistant prompt (versioned), the review queue's workflow, and the
-- cross-tenant usage figures. Every function here is SECURITY DEFINER
-- because the page spans every organisation; the backend's Owner-only
-- guard is what restricts them. Never call them from an unguarded route.

-- ── Prompt versions ────────────────────────────────────────────────────
-- One platform-wide system prompt for the assistant, shared by every
-- tenant (like machine_models, no tenant_id/RLS). Versions are immutable;
-- "saving" adds a version and exactly one version is live at a time.
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number  integer NOT NULL UNIQUE,
  body            text NOT NULL,
  notes           text,
  is_live         boolean NOT NULL DEFAULT false,
  -- SET NULL so delete_user_account() (0025) can still hard-delete an author.
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_versions_live
  ON ai_prompt_versions ((true)) WHERE is_live;

DROP TRIGGER IF EXISTS trg_ai_prompt_versions_bump_row_version ON ai_prompt_versions;
CREATE TRIGGER trg_ai_prompt_versions_bump_row_version
  BEFORE UPDATE ON ai_prompt_versions
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

GRANT SELECT, INSERT, UPDATE ON ai_prompt_versions TO field_app;

-- p_version_id NULL lists every version, newest first; otherwise just that
-- one. Author names come from users, which RLS scopes per tenant.
CREATE OR REPLACE FUNCTION admin_list_prompt_versions(p_version_id uuid DEFAULT NULL)
RETURNS TABLE (
  id                 uuid,
  version_number     integer,
  body               text,
  notes              text,
  is_live            boolean,
  created_at         timestamptz,
  published_at       timestamptz,
  created_by_name    varchar,
  published_by_name  varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT v.id, v.version_number, v.body, v.notes, v.is_live, v.created_at,
         v.published_at,
         (cu.first_name || ' ' || cu.last_name)::varchar,
         (pu.first_name || ' ' || pu.last_name)::varchar
  FROM ai_prompt_versions v
  LEFT JOIN users cu ON cu.id = v.created_by
  LEFT JOIN users pu ON pu.id = v.published_by
  WHERE p_version_id IS NULL OR v.id = p_version_id
  ORDER BY v.version_number DESC;
$$;

-- ── Review queue ───────────────────────────────────────────────────────
-- 0018's pending/reviewed becomes the four states the page shows, plus
-- a structured reason and the reviewer who picked the item up.
ALTER TABLE ai_review_items DROP CONSTRAINT IF EXISTS ai_review_items_status_check;
UPDATE ai_review_items SET status = 'unreviewed' WHERE status = 'pending';
UPDATE ai_review_items SET status = 'resolved' WHERE status = 'reviewed';
ALTER TABLE ai_review_items ALTER COLUMN status SET DEFAULT 'unreviewed';
ALTER TABLE ai_review_items ADD CONSTRAINT ai_review_items_status_check
  CHECK (status IN ('unreviewed', 'in_review', 'resolved', 'escalated'));

ALTER TABLE ai_review_items
  ADD COLUMN IF NOT EXISTS reason_code varchar
    CHECK (reason_code IN ('no_source', 'low_confidence', 'marked_wrong', 'safety_refusal')),
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_review_items_status_created
  ON ai_review_items (status, created_at DESC);

-- NULL filters are skipped. question is the technician's message that
-- prompted the flagged answer (the latest user message before it).
CREATE OR REPLACE FUNCTION admin_list_ai_review_items(
  p_status       varchar DEFAULT NULL,
  p_reviewer_id  uuid DEFAULT NULL,
  p_item_id      uuid DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  tenant_id          uuid,
  organisation_name  varchar,
  question           text,
  answer             text,
  reason_code        varchar,
  reason             text,
  notes              text,
  status             varchar,
  reviewer_id        uuid,
  reviewer_name      varchar,
  reviewer_avatar    varchar,
  flagged_at         timestamptz,
  reviewed_at        timestamptz,
  total_count        bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
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
  WHERE (p_status IS NULL OR ri.status = p_status)
    AND (p_reviewer_id IS NULL OR ri.reviewer_id = p_reviewer_id)
    AND (p_item_id IS NULL OR ri.id = p_item_id)
  ORDER BY ri.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION admin_count_ai_review_statuses()
RETURNS TABLE (status varchar, item_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT status, count(*) FROM ai_review_items GROUP BY status;
$$;

-- Everyone who has reviewed an item, for the Reviewer filter.
CREATE OR REPLACE FUNCTION admin_list_ai_reviewers()
RETURNS TABLE (id uuid, name varchar, avatar_url varchar)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT u.id, (u.first_name || ' ' || u.last_name)::varchar, u.avatar_url
  FROM ai_review_items ri
  JOIN users u ON u.id = ri.reviewer_id
  ORDER BY 2;
$$;

-- Moves an item through the workflow. NULL p_notes keeps the notes.
-- reviewed_at is stamped on resolve/escalate. Returns the item's
-- tenant_id, or NULL when there's no such item.
CREATE OR REPLACE FUNCTION admin_update_ai_review_item(
  p_item_id      uuid,
  p_status       varchar,
  p_reviewer_id  uuid,
  p_notes        text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ai_review_items
  SET status = p_status,
      reviewer_id = p_reviewer_id,
      notes = COALESCE(p_notes, notes),
      reviewed_at = CASE WHEN p_status IN ('resolved', 'escalated') THEN now()
                         ELSE NULL END
  WHERE id = p_item_id
  RETURNING tenant_id;
$$;

-- ── Usage ──────────────────────────────────────────────────────────────
-- A "query" is one technician message to the assistant. The window is
-- the last p_days days; prior_queries covers the p_days before that.
CREATE OR REPLACE FUNCTION admin_ai_usage_summary(p_days integer)
RETURNS TABLE (
  total_queries      bigint,
  prior_queries      bigint,
  active_users       bigint,
  total_users        bigint,
  total_cost         double precision,
  flagged_in_period  bigint,
  unreviewed_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH bounds AS (
    SELECT now() - make_interval(days => p_days) AS since,
           now() - make_interval(days => p_days * 2) AS prior_since
  )
  SELECT
    (SELECT count(*) FROM ai_messages, bounds
      WHERE role = 'user' AND created_at >= since),
    (SELECT count(*) FROM ai_messages, bounds
      WHERE role = 'user' AND created_at >= prior_since AND created_at < since),
    (SELECT count(DISTINCT c.user_id) FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id, bounds
      WHERE m.role = 'user' AND m.created_at >= since),
    (SELECT count(*) FROM users WHERE deleted_at IS NULL),
    (SELECT COALESCE(sum(cost_estimate), 0) FROM ai_usage_log, bounds
      WHERE created_at >= since),
    (SELECT count(*) FROM ai_review_items, bounds WHERE created_at >= since),
    (SELECT count(*) FROM ai_review_items WHERE status = 'unreviewed');
$$;

-- One row per day in the window, including days with no queries.
CREATE OR REPLACE FUNCTION admin_ai_queries_per_day(p_days integer)
RETURNS TABLE (day date, query_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT d::date,
         (SELECT count(*) FROM ai_messages
           WHERE role = 'user' AND created_at >= d AND created_at < d + interval '1 day')
  FROM generate_series(current_date - (p_days - 1), current_date, interval '1 day') AS d
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION admin_ai_usage_by_organisation(p_days integer, p_limit integer)
RETURNS TABLE (tenant_id uuid, organisation_name varchar, query_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id, t.name, count(*)
  FROM ai_messages m
  JOIN tenants t ON t.id = m.tenant_id
  WHERE m.role = 'user' AND m.created_at >= now() - make_interval(days => p_days)
  GROUP BY t.id, t.name
  ORDER BY 3 DESC, 2
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION admin_list_prompt_versions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_ai_review_items(varchar, uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_count_ai_review_statuses() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_ai_reviewers() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_update_ai_review_item(uuid, varchar, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_ai_usage_summary(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_ai_queries_per_day(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_ai_usage_by_organisation(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_prompt_versions(uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_list_ai_review_items(varchar, uuid, uuid, integer, integer) TO field_app;
GRANT EXECUTE ON FUNCTION admin_count_ai_review_statuses() TO field_app;
GRANT EXECUTE ON FUNCTION admin_list_ai_reviewers() TO field_app;
GRANT EXECUTE ON FUNCTION admin_update_ai_review_item(uuid, varchar, uuid, text) TO field_app;
GRANT EXECUTE ON FUNCTION admin_ai_usage_summary(integer) TO field_app;
GRANT EXECUTE ON FUNCTION admin_ai_queries_per_day(integer) TO field_app;
GRANT EXECUTE ON FUNCTION admin_ai_usage_by_organisation(integer, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0041_ai_admin_console')
ON CONFLICT (version) DO NOTHING;
