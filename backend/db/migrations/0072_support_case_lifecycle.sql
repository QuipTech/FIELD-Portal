-- Section 5f: the support case lifecycle around 0069's statuses.
--   * support_close_resolved_cases(): the daily job closes cases resolved
--     7+ days ago (src/supportCases/caseAutoClose.worker.ts), with a
--     case_events line and an audit entry each
--   * 0054's notification triggers: internal notes never reach the
--     customer, and staff are linked to the admin case screen
--   * 0064's case report and 0065's unactioned-case alert use the new
--     statuses (in_progress is gone; new and waiting_on_customer are open)

CREATE OR REPLACE FUNCTION support_close_resolved_cases(p_resolved_before timestamptz)
RETURNS TABLE (closed_tenant_id uuid, closed_case_number bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH closed AS (
    UPDATE support_cases c SET status = 'closed'
    WHERE c.status = 'resolved' AND c.deleted_at IS NULL
      AND c.resolved_at <= p_resolved_before
      AND NOT EXISTS (
        SELECT 1 FROM support_updates u
        WHERE u.support_case_id = c.id AND NOT u.is_internal AND u.created_at > c.resolved_at
      )
    RETURNING c.id, c.tenant_id, c.case_number
  ),
  events AS (
    INSERT INTO case_events (tenant_id, support_case_id, actor_id, type, from_value, to_value)
    SELECT closed.tenant_id, closed.id, NULL, 'status_changed', 'resolved', 'closed' FROM closed
  ),
  audits AS (
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
    SELECT closed.tenant_id, NULL, 'update', 'support_case', closed.id,
           jsonb_build_object('caseNumber', closed.case_number, 'reason', 'auto_close',
                              'status', jsonb_build_object('from', 'resolved', 'to', 'closed'))
    FROM closed
  )
  SELECT closed.tenant_id, closed.case_number FROM closed;
$$;

REVOKE ALL ON FUNCTION support_close_resolved_cases(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION support_close_resolved_cases(timestamptz) TO field_app;

-- ── Notifications ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION case_status_label(p_status varchar)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_status WHEN 'waiting_on_customer' THEN 'waiting on you' ELSE p_status END;
$$;

CREATE OR REPLACE FUNCTION notify_case_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case    support_cases%ROWTYPE;
  v_author  text;
  v_body    text;
BEGIN
  IF NEW.author_role = 'system' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_case FROM support_cases WHERE id = NEW.support_case_id;
  SELECT first_name || ' ' || last_name INTO v_author FROM users WHERE id = NEW.created_by;
  v_body := COALESCE(v_author || ': ', '') || left(regexp_replace(NEW.note, '\s+', ' ', 'g'), 140);
  IF NOT NEW.is_internal THEN
    PERFORM notify_users(ARRAY[v_case.created_by], NEW.created_by, 'case_message',
      'New reply on case #' || v_case.case_number, v_body, '/cases/' || v_case.case_number);
  END IF;
  PERFORM notify_users(ARRAY[v_case.assigned_to], NEW.created_by, 'case_message',
    CASE WHEN NEW.is_internal THEN 'New internal note on case #' ELSE 'New reply on case #' END
      || v_case.case_number,
    v_body, '/admin/cases/' || v_case.case_number);
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION notify_case_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_link text := '/cases/' || NEW.case_number;
  v_staff_link    text := '/admin/cases/' || NEW.case_number;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM notify_users(ARRAY[NEW.assigned_to], NULL, 'case_assigned',
      'Case #' || NEW.case_number || ' was assigned to you', NEW.subject, v_staff_link);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM notify_users(ARRAY[NEW.created_by], NULL, 'case_status',
      'Case #' || NEW.case_number || ' is now ' || case_status_label(NEW.status),
      NEW.subject, v_customer_link);
    PERFORM notify_users(ARRAY[NEW.assigned_to], NULL, 'case_status',
      'Case #' || NEW.case_number || ' is now ' || replace(NEW.status, '_', ' '),
      NEW.subject, v_staff_link);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM notify_users(ARRAY[NEW.created_by], NULL, 'case_priority',
      'Case #' || NEW.case_number || ' priority changed to ' || NEW.priority,
      NEW.subject, v_customer_link);
    PERFORM notify_users(ARRAY[NEW.assigned_to], NULL, 'case_priority',
      'Case #' || NEW.case_number || ' priority changed to ' || NEW.priority,
      NEW.subject, v_staff_link);
  END IF;
  RETURN NEW;
END
$$;

-- ── Reports and alerts ─────────────────────────────────────────────────
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
    AND (c.status NOT IN ('resolved', 'closed') OR c.resolved_at >= p_resolved_since)
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION alert_find_unactioned_cases(p_tenant_id uuid, p_priority text, p_minutes integer)
RETURNS TABLE (case_id uuid, case_number bigint, subject text, site text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT c.id, c.case_number, c.subject::text, NULLIF(m.site, '')::text, c.created_at
  FROM support_cases c
  LEFT JOIN machines m ON m.id = c.machine_id
  WHERE c.tenant_id = p_tenant_id AND c.deleted_at IS NULL
    AND c.status IN ('new', 'open') AND c.priority = p_priority
    AND c.created_at <= now() - make_interval(mins => p_minutes)
    AND NOT EXISTS (
      SELECT 1 FROM support_updates u
      WHERE u.support_case_id = c.id AND u.created_by IS DISTINCT FROM c.created_by
        AND NOT u.is_internal
    );
$$;

INSERT INTO schema_migrations (version)
VALUES ('0072_support_case_lifecycle')
ON CONFLICT (version) DO NOTHING;
