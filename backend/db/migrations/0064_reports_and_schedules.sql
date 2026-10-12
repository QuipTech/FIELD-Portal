-- Section 1s: Settings → Reports & exports. Read-only report functions
-- for the quick CSV exports (SECURITY DEFINER: the Owner's reports span
-- every organisation; p_tenant_id narrows them to one), and the
-- scheduled_reports the report worker emails out.

-- Fleet uptime per organisation and site since p_since. Each machine's
-- status before the window counts from the window's start; "down" time is
-- downtime, everything else (running, service due) is up.
CREATE OR REPLACE FUNCTION admin_report_fleet_uptime(p_tenant_id uuid, p_since timestamptz)
RETURNS TABLE (
  organisation_name text, site text, machine_count bigint,
  tracked_hours double precision, down_hours double precision
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH events AS (
    SELECT e.tenant_id, e.machine_id, e.status, e.changed_at
    FROM machine_status_events e
    JOIN machines m ON m.id = e.machine_id AND m.deleted_at IS NULL
    WHERE e.changed_at >= p_since AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
    UNION ALL
    (SELECT DISTINCT ON (e.machine_id) e.tenant_id, e.machine_id, e.status, e.changed_at
     FROM machine_status_events e
     JOIN machines m ON m.id = e.machine_id AND m.deleted_at IS NULL
     WHERE e.changed_at < p_since AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
     ORDER BY e.machine_id, e.changed_at DESC)
  ), spans AS (
    SELECT tenant_id, machine_id, status,
           GREATEST(changed_at, p_since) AS span_start,
           COALESCE(lead(changed_at) OVER (PARTITION BY machine_id ORDER BY changed_at), now()) AS span_end
    FROM events
  )
  SELECT t.name::text, COALESCE(NULLIF(m.site, ''), 'No site')::text,
         count(DISTINCT s.machine_id),
         sum(extract(epoch FROM s.span_end - s.span_start)) / 3600,
         sum(CASE WHEN s.status = 'down' THEN extract(epoch FROM s.span_end - s.span_start) ELSE 0 END) / 3600
  FROM spans s
  JOIN machines m ON m.id = s.machine_id
  JOIN tenants t ON t.id = s.tenant_id
  WHERE s.span_end > s.span_start
  GROUP BY t.name, COALESCE(NULLIF(m.site, ''), 'No site')
  ORDER BY 1, 2;
$$;

-- Every open or in-progress case, plus cases resolved since p_resolved_since.
CREATE OR REPLACE FUNCTION admin_report_cases(p_tenant_id uuid, p_resolved_since timestamptz)
RETURNS TABLE (
  case_number bigint, organisation_name text, site text, subject text,
  priority text, category text, status text,
  created_at timestamptz, resolved_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT c.case_number, t.name::text, NULLIF(m.site, '')::text, c.subject::text,
         c.priority::text, c.category::text, c.status::text, c.created_at, c.resolved_at
  FROM support_cases c
  JOIN tenants t ON t.id = c.tenant_id
  LEFT JOIN machines m ON m.id = c.machine_id
  WHERE c.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (c.status <> 'resolved' OR c.resolved_at >= p_resolved_since)
  ORDER BY c.created_at DESC;
$$;

-- AI usage per organisation for the last p_days. Platform work with no
-- organisation (prompt tests, shared documents) is its own row, for the
-- Owner only.
CREATE OR REPLACE FUNCTION admin_report_ai_usage(p_tenant_id uuid, p_days integer)
RETURNS TABLE (
  organisation_name text, query_count bigint, active_users bigint,
  assistant_cost double precision, other_cost double precision, flagged_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH bounds AS (SELECT now() - make_interval(days => p_days) AS since),
  queries AS (
    SELECT m.tenant_id, count(*) AS n, count(DISTINCT c.user_id) AS users
    FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id, bounds
    WHERE m.role = 'user' AND m.created_at >= bounds.since
    GROUP BY m.tenant_id
  ), answers AS (
    SELECT tenant_id, sum(cost_estimate) AS cost FROM ai_usage_log, bounds
    WHERE created_at >= bounds.since GROUP BY tenant_id
  ), other AS (
    SELECT tenant_id, sum(cost_estimate) AS cost FROM ai_platform_usage_log, bounds
    WHERE created_at >= bounds.since GROUP BY tenant_id
  ), flags AS (
    SELECT tenant_id, count(*) AS n FROM ai_review_items, bounds
    WHERE created_at >= bounds.since GROUP BY tenant_id
  ), organisations AS (
    SELECT tenant_id FROM queries UNION SELECT tenant_id FROM answers
    UNION SELECT tenant_id FROM other UNION SELECT tenant_id FROM flags
  )
  SELECT COALESCE(t.name, 'Platform (prompt tests, shared documents)')::text,
         COALESCE(q.n, 0), COALESCE(q.users, 0),
         COALESCE(a.cost, 0), COALESCE(o.cost, 0), COALESCE(f.n, 0)
  FROM organisations ids
  LEFT JOIN tenants t ON t.id = ids.tenant_id
  LEFT JOIN queries q ON q.tenant_id = ids.tenant_id
  LEFT JOIN answers a ON a.tenant_id = ids.tenant_id
  LEFT JOIN other o ON o.tenant_id IS NOT DISTINCT FROM ids.tenant_id
  LEFT JOIN flags f ON f.tenant_id = ids.tenant_id
  WHERE p_tenant_id IS NULL OR ids.tenant_id = p_tenant_id
  ORDER BY ids.tenant_id IS NULL, t.name;
$$;

REVOKE ALL ON FUNCTION admin_report_fleet_uptime(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_report_fleet_uptime(uuid, timestamptz) TO field_app;
REVOKE ALL ON FUNCTION admin_report_cases(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_report_cases(uuid, timestamptz) TO field_app;
REVOKE ALL ON FUNCTION admin_report_ai_usage(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_report_ai_usage(uuid, integer) TO field_app;

-- Platform-wide, like ai_prompt_versions: only the Owner manages them and
-- each report covers every organisation, so there's no tenant_id or RLS.
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(120) NOT NULL,
  report_type   text NOT NULL CHECK (report_type IN ('fleet_uptime', 'cases_sla', 'ai_usage', 'audit_log')),
  frequency     text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  -- ISO weekday, 1 = Monday. Only for weekly reports.
  day_of_week   smallint CHECK (day_of_week BETWEEN 1 AND 7),
  -- Up to 28 so every month has the day. Only for monthly reports.
  day_of_month  smallint CHECK (day_of_month BETWEEN 1 AND 28),
  send_hour     smallint NOT NULL CHECK (send_hour BETWEEN 0 AND 23),
  -- IANA zone the send hour is in, e.g. Australia/Perth.
  timezone      text NOT NULL,
  recipients    text[] NOT NULL CHECK (cardinality(recipients) BETWEEN 1 AND 20),
  format        text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv')),
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  next_run_at   timestamptz NOT NULL,
  -- Set while a worker is sending it; a stale claim is taken over.
  claimed_at    timestamptz,
  last_sent_at  timestamptz,
  last_status   text CHECK (last_status IN ('sent', 'failed')),
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  row_version   integer NOT NULL DEFAULT 1,
  deleted_at    timestamptz,
  CONSTRAINT scheduled_reports_day_matches_frequency CHECK (
    (frequency = 'weekly') = (day_of_week IS NOT NULL)
    AND (frequency = 'monthly') = (day_of_month IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run
  ON scheduled_reports (next_run_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_scheduled_reports_bump_row_version ON scheduled_reports;
CREATE TRIGGER trg_scheduled_reports_bump_row_version
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

GRANT SELECT, INSERT, UPDATE ON scheduled_reports TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0064_reports_and_schedules')
ON CONFLICT (version) DO NOTHING;
