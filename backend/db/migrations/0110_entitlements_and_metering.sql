-- Section 8g: entitlements by feature key and fair-use metering (FIELD
-- billing spec sections 5 and 6). Entitlements now come from the billing
-- account's live subscriptions (plan → feature keys), never from Stripe
-- and never from a plan-name comparison in code. app.subscriptions and
-- app.entitlements stay for history but no longer decide access.

-- ── Feature keys (spec section 5) ──────────────────────────────────────
INSERT INTO platform.features (code, name, kind, unit) VALUES
  ('ai.assistant', 'AI assistant', 'boolean', NULL),
  ('knowledge.read', 'Knowledge library', 'boolean', NULL),
  ('fleet.register', 'Load and keep machine records', 'boolean', NULL),
  ('fleet.import', 'Fleet import (Excel/CSV)', 'boolean', NULL),
  ('asset.history', 'Full history on active machines', 'boolean', NULL),
  ('remote.session', 'Remote technical sessions (metered)', 'boolean', NULL),
  ('org.users.unlimited', 'Unlimited named users', 'boolean', NULL),
  ('sso.saml', 'SAML single sign-on', 'boolean', NULL),
  ('whitelabel', 'White label', 'boolean', NULL),
  ('oem.licence_controls', 'OEM licence controls', 'boolean', NULL)
ON CONFLICT (code) DO NOTHING;

-- The spec's table. INTERNAL (QuipTech and demo organisations) gets
-- everything.
INSERT INTO platform.plan_features (plan_code, feature_code, is_enabled, limit_value)
SELECT f.plan_code, f.feature_code, f.is_enabled, NULL
FROM (VALUES
  ('TECH', 'ai.assistant', true), ('TECH', 'knowledge.read', true),
  ('TECH', 'fleet.register', false), ('TECH', 'fleet.import', false),
  ('TECH', 'asset.history', false), ('TECH', 'remote.session', true),
  ('TECH', 'org.users.unlimited', false), ('TECH', 'sso.saml', false),
  ('TECH', 'whitelabel', false), ('TECH', 'oem.licence_controls', false),
  ('ASSET_PRO', 'ai.assistant', true), ('ASSET_PRO', 'knowledge.read', true),
  ('ASSET_PRO', 'fleet.register', true), ('ASSET_PRO', 'fleet.import', true),
  ('ASSET_PRO', 'asset.history', true), ('ASSET_PRO', 'remote.session', true),
  ('ASSET_PRO', 'org.users.unlimited', true), ('ASSET_PRO', 'sso.saml', false),
  ('ASSET_PRO', 'whitelabel', false), ('ASSET_PRO', 'oem.licence_controls', false),
  ('ENTERPRISE', 'ai.assistant', true), ('ENTERPRISE', 'knowledge.read', true),
  ('ENTERPRISE', 'fleet.register', true), ('ENTERPRISE', 'fleet.import', true),
  ('ENTERPRISE', 'asset.history', true), ('ENTERPRISE', 'remote.session', true),
  ('ENTERPRISE', 'org.users.unlimited', true), ('ENTERPRISE', 'sso.saml', true),
  ('ENTERPRISE', 'whitelabel', true), ('ENTERPRISE', 'oem.licence_controls', true),
  ('INTERNAL', 'ai.assistant', true), ('INTERNAL', 'knowledge.read', true),
  ('INTERNAL', 'fleet.register', true), ('INTERNAL', 'fleet.import', true),
  ('INTERNAL', 'asset.history', true), ('INTERNAL', 'remote.session', true),
  ('INTERNAL', 'org.users.unlimited', true), ('INTERNAL', 'sso.saml', true),
  ('INTERNAL', 'whitelabel', true), ('INTERNAL', 'oem.licence_controls', true)
) AS f(plan_code, feature_code, is_enabled)
ON CONFLICT (plan_code, feature_code) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- The request organisation's feature keys, from its billing account's
-- live plans (started, not past cancel_at). Read by the tenant role, which
-- can't see billing or platform tables directly. An organisation that has
-- never had a plan resolves as ASSET_PRO (spec T22: every customer starts
-- on monthly ASSET_PRO), so a missing set-up never locks anyone out; a
-- cancelled plan resolves to nothing.
CREATE OR REPLACE FUNCTION current_feature_keys()
RETURNS TABLE (feature_code varchar, plan_code varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH account AS (
    SELECT current_billing_account_id() AS id
  ), live AS (
    SELECT s.plan_code FROM billing.subscriptions s, account a
    WHERE s.billing_account_id = a.id AND s.deleted_at IS NULL
      AND s.started_at <= now()
      AND (s.cancel_at IS NULL OR s.cancel_at > current_date)
  ), plans AS (
    SELECT plan_code FROM live
    UNION
    SELECT 'ASSET_PRO' WHERE NOT EXISTS (
      SELECT 1 FROM billing.subscriptions s, account a
      WHERE s.billing_account_id = a.id AND s.deleted_at IS NULL
    )
  )
  SELECT DISTINCT pf.feature_code, pf.plan_code
  FROM plans p
  JOIN platform.plan_features pf ON pf.plan_code = p.plan_code AND pf.is_enabled;
$$;

REVOKE ALL ON FUNCTION current_feature_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_feature_keys() TO field_app;

-- ── usage_event fields (spec section 6) ────────────────────────────────
-- Every row now names its billing account, and a retried write carries an
-- idempotency key so it is stored once (T28). attributes stay in metadata.
ALTER TABLE app.usage_events
  ADD COLUMN IF NOT EXISTS billing_account_id uuid REFERENCES billing.billing_accounts(id),
  ADD COLUMN IF NOT EXISTS unit varchar,
  ADD COLUMN IF NOT EXISTS idempotency_key varchar;
ALTER TABLE app.usage_events ALTER COLUMN quantity TYPE bigint;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_events_idempotency
  ON app.usage_events (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_events_account_type_time
  ON app.usage_events (billing_account_id, event_type, occurred_at DESC);

ALTER TABLE app.usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;
ALTER TABLE app.usage_events ADD CONSTRAINT usage_events_event_type_check CHECK (event_type IN (
  'ai_query', 'asset_added', 'seat_added', 'seat_removed', 'session_started',
  'ai.turn', 'ai.session', 'storage.delta', 'doc.ingest', 'remote.session'));

UPDATE app.usage_events e SET billing_account_id = t.billing_account_id
FROM tenants t WHERE t.id = e.tenant_id AND e.billing_account_id IS NULL;

-- Every metered row, from triggers and the app. A repeated idempotency key
-- is a no-op.
CREATE OR REPLACE FUNCTION app.record_metered_event(
  p_tenant_id        uuid,
  p_user_id          uuid,
  p_event_type       varchar,
  p_quantity         bigint,
  p_unit             varchar,
  p_subject_id       uuid,
  p_metadata         jsonb,
  p_idempotency_key  varchar
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO app.usage_events
    (tenant_id, billing_account_id, event_type, user_id, subject_id, quantity, unit,
     metadata, idempotency_key)
  SELECT p_tenant_id, t.billing_account_id, p_event_type, p_user_id, p_subject_id,
         p_quantity, p_unit, coalesce(p_metadata, '{}'::jsonb), p_idempotency_key
  FROM tenants t WHERE t.id = p_tenant_id
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
$$;

REVOKE ALL ON FUNCTION app.record_metered_event(uuid, uuid, varchar, bigint, varchar, uuid, jsonb, varchar) FROM PUBLIC;

-- The app's entry point (AI turns and sessions): only for the request's
-- own organisation and user.
CREATE OR REPLACE FUNCTION record_my_usage_event(
  p_event_type       varchar,
  p_quantity         bigint,
  p_unit             varchar,
  p_subject_id       uuid,
  p_metadata         jsonb,
  p_idempotency_key  varchar
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'no organisation in this request' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_event_type NOT IN ('ai.turn', 'ai.session') THEN
    RAISE EXCEPTION 'event type % is recorded by the database', p_event_type
      USING ERRCODE = 'check_violation';
  END IF;
  PERFORM app.record_metered_event(current_tenant_id(),
    NULLIF(current_setting('app.user_id', true), '')::uuid,
    p_event_type, p_quantity, p_unit, p_subject_id, p_metadata, p_idempotency_key);
END;
$$;

REVOKE ALL ON FUNCTION record_my_usage_event(varchar, bigint, varchar, uuid, jsonb, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_my_usage_event(varchar, bigint, varchar, uuid, jsonb, varchar) TO field_app;

-- Older trigger-written events now name their billing account too.
CREATE OR REPLACE FUNCTION app.record_usage_event(
  p_tenant_id   uuid,
  p_event_type  varchar,
  p_user_id     uuid,
  p_subject_id  uuid,
  p_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO app.usage_events (tenant_id, billing_account_id, event_type, user_id, subject_id, metadata)
  SELECT p_tenant_id, t.billing_account_id, p_event_type, p_user_id, p_subject_id, p_metadata
  FROM tenants t WHERE t.id = p_tenant_id;
$$;

-- ── storage.delta: bytes added or removed ──────────────────────────────
CREATE OR REPLACE FUNCTION app.meter_storage_delta()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bytes bigint;
  v_key varchar;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_bytes := coalesce(NEW.size_bytes, 0);
    v_key := 'storage.delta:' || TG_TABLE_NAME || ':' || NEW.id || ':add';
  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    v_bytes := -coalesce(OLD.size_bytes, 0);
    v_key := 'storage.delta:' || TG_TABLE_NAME || ':' || NEW.id || ':remove';
  ELSE
    RETURN NEW;
  END IF;
  IF v_bytes = 0 OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM app.record_metered_event(NEW.tenant_id,
    NULLIF(current_setting('app.user_id', true), '')::uuid, 'storage.delta',
    v_bytes, 'bytes', NEW.id, jsonb_build_object('objectType', TG_TABLE_NAME), v_key);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_machine_photos_meter_storage ON machine_photos;
CREATE TRIGGER trg_machine_photos_meter_storage
  AFTER INSERT OR UPDATE OF deleted_at ON machine_photos
  FOR EACH ROW EXECUTE FUNCTION app.meter_storage_delta();

DROP TRIGGER IF EXISTS trg_technical_attachments_meter_storage ON technical_attachments;
CREATE TRIGGER trg_technical_attachments_meter_storage
  AFTER INSERT OR UPDATE OF deleted_at ON technical_attachments
  FOR EACH ROW EXECUTE FUNCTION app.meter_storage_delta();

-- Documents are versioned and never soft-deleted row by row: an upload adds.
CREATE OR REPLACE FUNCTION app.meter_document_storage()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND coalesce(NEW.size_bytes, 0) > 0 THEN
    PERFORM app.record_metered_event(NEW.tenant_id, NEW.uploaded_by, 'storage.delta',
      NEW.size_bytes, 'bytes', NEW.id, jsonb_build_object('objectType', 'document_versions'),
      'storage.delta:document_versions:' || NEW.id || ':add');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_versions_meter_storage ON document_versions;
CREATE TRIGGER trg_document_versions_meter_storage
  AFTER INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION app.meter_document_storage();

-- What is already stored, once per organisation, so the storage allowance
-- starts from the real total rather than zero.
INSERT INTO app.usage_events
  (tenant_id, billing_account_id, event_type, quantity, unit, metadata, idempotency_key)
SELECT t.id, t.billing_account_id, 'storage.delta', totals.bytes, 'bytes',
       jsonb_build_object('objectType', 'baseline'), 'storage.delta:baseline:' || t.id
FROM tenants t
CROSS JOIN LATERAL (
  SELECT coalesce((SELECT sum(size_bytes) FROM machine_photos WHERE tenant_id = t.id AND deleted_at IS NULL), 0)
       + coalesce((SELECT sum(size_bytes) FROM technical_attachments WHERE tenant_id = t.id AND deleted_at IS NULL), 0)
       + coalesce((SELECT sum(size_bytes) FROM document_versions WHERE tenant_id = t.id), 0) AS bytes
) totals
WHERE t.deleted_at IS NULL AND totals.bytes > 0
ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

-- ── doc.ingest: pages and bytes once a document version is indexed ─────
CREATE OR REPLACE FUNCTION app.meter_document_ingest()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.ingestion_status = 'ready' AND OLD.ingestion_status IS DISTINCT FROM 'ready'
     AND NEW.tenant_id IS NOT NULL THEN
    PERFORM app.record_metered_event(NEW.tenant_id, NEW.uploaded_by, 'doc.ingest',
      greatest(coalesce(NEW.page_count, 0), 0), 'pages', NEW.id,
      jsonb_build_object('documentId', NEW.document_id, 'bytes', NEW.size_bytes),
      'doc.ingest:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_versions_meter_ingest ON document_versions;
CREATE TRIGGER trg_document_versions_meter_ingest
  AFTER UPDATE OF ingestion_status ON document_versions
  FOR EACH ROW EXECUTE FUNCTION app.meter_document_ingest();

-- ── Allowance periods (spec section 6) ─────────────────────────────────
-- One row per account, month and metric: the month's allowance, use so
-- far, the threshold reached (80% notified, 100% flagged) and how many
-- months in a row ended over 100%. Nothing here ever blocks a session.
CREATE TABLE IF NOT EXISTS billing.allowance_periods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  period_start        date NOT NULL,
  metric              varchar NOT NULL CHECK (metric IN ('ai_turns', 'storage_bytes', 'ingest_pages')),
  allowance           bigint NOT NULL CHECK (allowance >= 0),
  used                bigint NOT NULL DEFAULT 0,
  threshold_state     varchar NOT NULL DEFAULT 'ok'
                        CHECK (threshold_state IN ('ok', 'notified', 'flagged')),
  consecutive_over    integer NOT NULL DEFAULT 0 CHECK (consecutive_over >= 0),
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz,
  UNIQUE (billing_account_id, period_start, metric)
);

ALTER TABLE billing.allowance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.allowance_periods FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allowance_periods_own_select ON billing.allowance_periods;
CREATE POLICY allowance_periods_own_select ON billing.allowance_periods
  FOR SELECT TO field_app USING (billing_account_id = current_billing_account_id());
DROP POLICY IF EXISTS allowance_periods_service_all ON billing.allowance_periods;
CREATE POLICY allowance_periods_service_all ON billing.allowance_periods
  FOR ALL TO field_service USING (true) WITH CHECK (true);
GRANT SELECT ON billing.allowance_periods TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.allowance_periods TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0110_entitlements_and_metering')
ON CONFLICT (version) DO NOTHING;
