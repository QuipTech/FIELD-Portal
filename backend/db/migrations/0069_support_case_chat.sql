-- Section 5c: one shared chat thread per support case, worked by QuipTech
-- support staff across organisations (0070 adds their access).
--   * statuses become new → open → waiting_on_customer → resolved → closed
--     (in_progress folds into open; an unassigned open case becomes new)
--   * an SLA due time that pauses while waiting on the customer
--   * support_updates (the thread) gain an author role and internal notes,
--     which only staff ever read
--   * support_attachments hang off a message; a customer's upload waits
--     unlinked (no case yet) until the message that carries it is sent
--   * case_events: assignment/status/priority/reopen lines in the thread
--   * support_case_reads: where each person last read a case (unread badge)

-- ── Statuses ───────────────────────────────────────────────────────────
ALTER TABLE support_cases DROP CONSTRAINT IF EXISTS support_cases_status_check;
UPDATE support_cases SET status = 'open' WHERE status = 'in_progress';
UPDATE support_cases SET status = 'new' WHERE status = 'open' AND assigned_to IS NULL;
ALTER TABLE support_cases ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE support_cases ADD CONSTRAINT support_cases_status_check
  CHECK (status IN ('new', 'open', 'waiting_on_customer', 'resolved', 'closed'));

-- ── Description, SLA, closing ──────────────────────────────────────────
ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Older cases: the description was only ever the first message; the SLA
-- uses the defaults the dashboard has always used (4 / 24 / 72 hours).
UPDATE support_cases c SET description = first.note
FROM (
  SELECT DISTINCT ON (support_case_id) support_case_id, note
  FROM support_updates ORDER BY support_case_id, created_at, id
) first
WHERE first.support_case_id = c.id AND c.description IS NULL;

UPDATE support_cases SET sla_due_at = created_at + CASE priority
  WHEN 'P1' THEN interval '4 hours' WHEN 'P2' THEN interval '24 hours'
  ELSE interval '72 hours' END
WHERE sla_due_at IS NULL;

-- Timestamps and the SLA clock follow the status, whoever changes it:
-- waiting_on_customer stops the clock, leaving it pushes the due time out
-- by however long it was stopped.
CREATE OR REPLACE FUNCTION support_cases_follow_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'waiting_on_customer' AND NOT OLD.sla_paused THEN
    NEW.sla_paused := true;
    NEW.sla_paused_at := now();
  ELSIF NEW.status <> 'waiting_on_customer' AND OLD.sla_paused THEN
    NEW.sla_due_at := NEW.sla_due_at + (now() - OLD.sla_paused_at);
    NEW.sla_paused := false;
    NEW.sla_paused_at := NULL;
  END IF;
  NEW.resolved_at := CASE
    WHEN NEW.status = 'resolved' THEN COALESCE(OLD.resolved_at, now())
    WHEN NEW.status = 'closed' THEN OLD.resolved_at
    ELSE NULL END;
  NEW.closed_at := CASE WHEN NEW.status = 'closed' THEN now() ELSE NULL END;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_support_cases_follow_status ON support_cases;
CREATE TRIGGER trg_support_cases_follow_status
  BEFORE UPDATE OF status ON support_cases
  FOR EACH ROW EXECUTE FUNCTION support_cases_follow_status();

CREATE INDEX IF NOT EXISTS idx_support_cases_assignee_status
  ON support_cases (assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_cases_resolved_at
  ON support_cases (resolved_at) WHERE status = 'resolved' AND deleted_at IS NULL;

-- ── The thread ─────────────────────────────────────────────────────────
ALTER TABLE support_updates
  ADD COLUMN IF NOT EXISTS author_role varchar NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- Until now everyone but the reporter answered as support.
UPDATE support_updates u SET author_role = 'assignee'
FROM support_cases c
WHERE c.id = u.support_case_id AND u.created_by IS DISTINCT FROM c.created_by;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_updates_author_role_check') THEN
    ALTER TABLE support_updates ADD CONSTRAINT support_updates_author_role_check
      CHECK (author_role IN ('customer', 'assignee', 'admin', 'system'));
  END IF;
  -- Only staff write internal notes.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_updates_internal_check') THEN
    ALTER TABLE support_updates ADD CONSTRAINT support_updates_internal_check
      CHECK (NOT is_internal OR author_role IN ('assignee', 'admin'));
  END IF;
END
$$;

-- ── Attachments ────────────────────────────────────────────────────────
ALTER TABLE support_attachments
  ALTER COLUMN support_case_id DROP NOT NULL,
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES support_updates(id),
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_key varchar,
  ADD COLUMN IF NOT EXISTS file_name varchar,
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_support_attachments_message_id ON support_attachments(message_id);

-- Linking an upload to its message is an update.
DROP POLICY IF EXISTS support_attachments_update ON support_attachments;
CREATE POLICY support_attachments_update ON support_attachments
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  support_case_id  uuid NOT NULL REFERENCES support_cases(id),
  -- NULL for the system (e.g. the auto-close job) or a deleted user.
  actor_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  type             varchar NOT NULL CHECK (type IN (
                     'created', 'assigned', 'unassigned', 'status_changed',
                     'priority_changed', 'reopened')),
  from_value       varchar,
  to_value         varchar,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_created ON case_events (support_case_id, created_at);

ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_events_select ON case_events;
CREATE POLICY case_events_select ON case_events
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS case_events_insert ON case_events;
CREATE POLICY case_events_insert ON case_events
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Append-only, like the audit log.
REVOKE UPDATE, DELETE ON case_events FROM field_app;

-- ── Read markers ───────────────────────────────────────────────────────
-- tenant_id is the case's organisation, also for staff from QuipTech.
CREATE TABLE IF NOT EXISTS support_case_reads (
  support_case_id  uuid NOT NULL REFERENCES support_cases(id),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  last_read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (support_case_id, user_id)
);

ALTER TABLE support_case_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_case_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_case_reads_select ON support_case_reads;
CREATE POLICY support_case_reads_select ON support_case_reads
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_case_reads_insert ON support_case_reads;
CREATE POLICY support_case_reads_insert ON support_case_reads
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_case_reads_update ON support_case_reads;
CREATE POLICY support_case_reads_update ON support_case_reads
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0069_support_case_chat')
ON CONFLICT (version) DO NOTHING;
