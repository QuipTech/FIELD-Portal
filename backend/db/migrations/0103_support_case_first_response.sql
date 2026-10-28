-- Section 5f: SLA fields for the mobile app. support_cases.first_response_at
-- is when support staff first replied in the thread, visible to the
-- customer (internal notes don't count). A trigger sets it, whoever posts,
-- and older cases are backfilled. admin_list_support_cases (0071) also
-- returns it now.

ALTER TABLE support_cases ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

UPDATE support_cases c SET first_response_at = first.created_at
FROM (
  SELECT support_case_id, min(created_at) AS created_at FROM support_updates
  WHERE author_role IN ('assignee', 'admin') AND NOT is_internal AND deleted_at IS NULL
  GROUP BY support_case_id
) first
WHERE first.support_case_id = c.id AND c.first_response_at IS NULL;

-- SECURITY DEFINER: staff post under the case's tenant, but the update
-- shouldn't depend on support_cases' RLS update policy.
CREATE OR REPLACE FUNCTION support_cases_record_first_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE support_cases SET first_response_at = NEW.created_at
  WHERE id = NEW.support_case_id AND first_response_at IS NULL;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_support_updates_first_response ON support_updates;
CREATE TRIGGER trg_support_updates_first_response
  AFTER INSERT ON support_updates
  FOR EACH ROW
  WHEN (NEW.author_role IN ('assignee', 'admin') AND NOT NEW.is_internal)
  EXECUTE FUNCTION support_cases_record_first_response();

REVOKE ALL ON FUNCTION support_cases_record_first_response() FROM PUBLIC;

-- Same as 0071 plus first_response_at; the return type changes, so drop first.
DROP FUNCTION IF EXISTS admin_list_support_cases(uuid, uuid, varchar, uuid, varchar, varchar, varchar, integer, integer);

CREATE FUNCTION admin_list_support_cases(
  p_viewer_id      uuid,
  p_only_assignee  uuid,
  p_tab            varchar,
  p_tenant_id      uuid,
  p_priority       varchar,
  p_status         varchar,
  p_search         varchar,
  p_limit          integer,
  p_offset         integer
)
RETURNS TABLE (
  id uuid, case_number bigint, tenant_id uuid, tenant_name varchar, subject varchar,
  status varchar, priority varchar, created_at timestamptz, updated_at timestamptz,
  resolved_at timestamptz, sla_due_at timestamptz, sla_paused_at timestamptz,
  first_response_at timestamptz,
  reporter_first_name varchar, reporter_last_name varchar,
  assignee_id uuid, assignee_first_name varchar, assignee_last_name varchar,
  assignee_avatar_url varchar, is_unread boolean, total_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT c.id, c.case_number, c.tenant_id, t.name, c.subject, c.status, c.priority,
         c.created_at, c.updated_at, c.resolved_at, c.sla_due_at, c.sla_paused_at,
         c.first_response_at,
         r.first_name, r.last_name, a.id, a.first_name, a.last_name, a.avatar_url,
         EXISTS (
           SELECT 1 FROM support_updates u
           LEFT JOIN support_case_reads cr ON cr.support_case_id = c.id AND cr.user_id = p_viewer_id
           WHERE u.support_case_id = c.id AND u.created_by IS DISTINCT FROM p_viewer_id
             AND u.created_at > COALESCE(cr.last_read_at, '-infinity')
         ),
         count(*) OVER ()
  FROM support_cases c
  JOIN tenants t ON t.id = c.tenant_id
  LEFT JOIN users r ON r.id = c.created_by
  LEFT JOIN users a ON a.id = c.assigned_to
  WHERE c.deleted_at IS NULL
    AND (p_only_assignee IS NULL OR c.assigned_to = p_only_assignee)
    AND CASE p_tab
          WHEN 'unassigned' THEN c.assigned_to IS NULL AND c.status NOT IN ('resolved', 'closed')
          WHEN 'mine' THEN c.assigned_to = p_viewer_id AND c.status NOT IN ('resolved', 'closed')
          WHEN 'open' THEN c.status IN ('new', 'open', 'waiting_on_customer')
          WHEN 'resolved' THEN c.status IN ('resolved', 'closed')
          ELSE true
        END
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (p_priority IS NULL OR c.priority = p_priority)
    AND (p_status IS NULL OR c.status = p_status)
    AND (
      p_search IS NULL
      OR c.subject ILIKE '%' || p_search || '%'
      OR c.case_number::text = ltrim(p_search, '#')
      OR t.name ILIKE '%' || p_search || '%'
    )
  ORDER BY c.updated_at DESC, c.id
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION admin_list_support_cases(uuid, uuid, varchar, uuid, varchar, varchar, varchar, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_support_cases(uuid, uuid, varchar, uuid, varchar, varchar, varchar, integer, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0103_support_case_first_response')
ON CONFLICT (version) DO NOTHING;
