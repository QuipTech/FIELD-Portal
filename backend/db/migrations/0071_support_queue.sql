-- Section 5e: the support queue's reads across every organisation (A13):
-- the list with its tabs and filters, the stat cards, the assign
-- dropdown's staff list and the staff nav badge. The backend passes
-- p_only_assignee for a Support Agent (their own cases only) and NULL
-- only for the admin (src/supportCases/supportStaff.guard.ts).

-- p_tab: unassigned | mine | open | resolved | all.
CREATE OR REPLACE FUNCTION admin_list_support_cases(
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
  sla_due_at timestamptz, sla_paused_at timestamptz,
  reporter_first_name varchar, reporter_last_name varchar,
  assignee_id uuid, assignee_first_name varchar, assignee_last_name varchar,
  assignee_avatar_url varchar, is_unread boolean, total_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT c.id, c.case_number, c.tenant_id, t.name, c.subject, c.status, c.priority,
         c.created_at, c.updated_at, c.sla_due_at, c.sla_paused_at,
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

-- The stat cards, plus the counts on the "Assigned to me" and "All open" tabs.
CREATE OR REPLACE FUNCTION admin_support_case_stats(p_viewer_id uuid, p_only_assignee uuid)
RETURNS TABLE (
  unassigned bigint, open bigint, waiting_on_customer bigint, sla_breached bigint,
  assigned_to_viewer bigint, all_open bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT count(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('resolved', 'closed')),
         count(*) FILTER (WHERE status = 'open'),
         count(*) FILTER (WHERE status = 'waiting_on_customer'),
         count(*) FILTER (WHERE status IN ('new', 'open') AND sla_due_at < now()),
         count(*) FILTER (WHERE assigned_to = p_viewer_id AND status NOT IN ('resolved', 'closed')),
         count(*) FILTER (WHERE status IN ('new', 'open', 'waiting_on_customer'))
  FROM support_cases
  WHERE deleted_at IS NULL
    AND (p_only_assignee IS NULL OR assigned_to = p_only_assignee);
$$;

-- The assign dropdown (A13c): every support person, busiest last.
CREATE OR REPLACE FUNCTION admin_list_support_staff()
RETURNS TABLE (
  id uuid, first_name varchar, last_name varchar, email varchar,
  avatar_url varchar, is_admin boolean, open_case_count bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url,
         user_has_permission(u.id, 'platform.manage'),
         (SELECT count(*) FROM support_cases c
           WHERE c.assigned_to = u.id AND c.deleted_at IS NULL
             AND c.status IN ('new', 'open', 'waiting_on_customer'))
  FROM users u
  WHERE u.deleted_at IS NULL AND u.status = 'active'
    AND user_has_permission(u.id, 'support.agent')
  ORDER BY u.first_name, u.last_name;
$$;

-- The staff nav badge: my cases with a message I haven't read.
CREATE OR REPLACE FUNCTION support_staff_unread_case_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT count(*) FROM support_cases c
  WHERE c.assigned_to = p_user_id AND c.deleted_at IS NULL AND c.status <> 'closed'
    AND EXISTS (
      SELECT 1 FROM support_updates u
      LEFT JOIN support_case_reads cr ON cr.support_case_id = c.id AND cr.user_id = p_user_id
      WHERE u.support_case_id = c.id AND u.created_by IS DISTINCT FROM p_user_id
        AND u.created_at > COALESCE(cr.last_read_at, '-infinity')
    );
$$;

REVOKE ALL ON FUNCTION admin_list_support_cases(uuid, uuid, varchar, uuid, varchar, varchar, varchar, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_support_case_stats(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_list_support_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION support_staff_unread_case_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_support_cases(uuid, uuid, varchar, uuid, varchar, varchar, varchar, integer, integer) TO field_app;
GRANT EXECUTE ON FUNCTION admin_support_case_stats(uuid, uuid) TO field_app;
GRANT EXECUTE ON FUNCTION admin_list_support_staff() TO field_app;
GRANT EXECUTE ON FUNCTION support_staff_unread_case_count(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0071_support_queue')
ON CONFLICT (version) DO NOTHING;
