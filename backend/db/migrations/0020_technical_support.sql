-- Section 5: Technical Support (Phase 1 data model). Zoho Desk is the
-- system of record — zoho_ticket_id is a reference field only, live sync
-- is Phase 2.

CREATE TABLE IF NOT EXISTS support_cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  machine_id       uuid REFERENCES machines(id),
  zoho_ticket_id   varchar,
  subject          varchar NOT NULL,
  status           varchar NOT NULL DEFAULT 'open',
  assigned_to      uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1,
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_cases_tenant_id ON support_cases(tenant_id);

DROP TRIGGER IF EXISTS trg_support_cases_bump_row_version ON support_cases;
CREATE TRIGGER trg_support_cases_bump_row_version
  BEFORE UPDATE ON support_cases
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_cases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_cases_select ON support_cases;
CREATE POLICY support_cases_select ON support_cases
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_cases_insert ON support_cases;
CREATE POLICY support_cases_insert ON support_cases
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_cases_update ON support_cases;
CREATE POLICY support_cases_update ON support_cases
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS support_updates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  note              text NOT NULL,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_support_updates_tenant_id ON support_updates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_updates_support_case_id ON support_updates(support_case_id);

ALTER TABLE support_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_updates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_updates_select ON support_updates;
CREATE POLICY support_updates_select ON support_updates
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_updates_insert ON support_updates;
CREATE POLICY support_updates_insert ON support_updates
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS support_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  file_url          varchar NOT NULL,
  file_type         varchar NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_tenant_id ON support_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_support_case_id ON support_attachments(support_case_id);

ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_attachments_select ON support_attachments;
CREATE POLICY support_attachments_select ON support_attachments
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_attachments_insert ON support_attachments;
CREATE POLICY support_attachments_insert ON support_attachments
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- escalated_by is a user reference (uuid), for consistency with
-- ai_escalations.escalated_by elsewhere in this schema.
CREATE TABLE IF NOT EXISTS support_escalations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  support_case_id   uuid NOT NULL REFERENCES support_cases(id),
  escalated_by      uuid NOT NULL REFERENCES users(id),
  reason            text,
  status            varchar NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_support_escalations_tenant_id ON support_escalations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_escalations_support_case_id ON support_escalations(support_case_id);

DROP TRIGGER IF EXISTS trg_support_escalations_bump_row_version ON support_escalations;
CREATE TRIGGER trg_support_escalations_bump_row_version
  BEFORE UPDATE ON support_escalations
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

ALTER TABLE support_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_escalations_select ON support_escalations;
CREATE POLICY support_escalations_select ON support_escalations
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_escalations_insert ON support_escalations;
CREATE POLICY support_escalations_insert ON support_escalations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS support_escalations_update ON support_escalations;
CREATE POLICY support_escalations_update ON support_escalations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

INSERT INTO schema_migrations (version)
VALUES ('0020_technical_support')
ON CONFLICT (version) DO NOTHING;
