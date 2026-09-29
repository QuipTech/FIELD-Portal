-- Section 8d: Profile & settings → My data. A user can ask for an export
-- of their own data (built by a background worker into a JSON file in S3,
-- offered as a short-lived download link) and can request deletion of
-- their account (recorded and audited for an admin to act on — nothing is
-- deleted automatically, and the organisation's CMDB/asset data is never
-- part of a user's deletion). Both are RLS-scoped to the tenant; rows go
-- with the user if the account is deleted.

CREATE TABLE IF NOT EXISTS data_export_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        varchar NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'ready', 'failed', 'expired')),
  storage_key   varchar,
  size_bytes    bigint,
  error         text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  -- When the file is deleted and the link stops working.
  expires_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  row_version   integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user ON data_export_requests (user_id, requested_at DESC);
-- One export in flight per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_data_export_requests_active
  ON data_export_requests (user_id) WHERE status IN ('queued', 'running');

DROP TRIGGER IF EXISTS trg_data_export_requests_bump_row_version ON data_export_requests;
CREATE TRIGGER trg_data_export_requests_bump_row_version
  BEFORE UPDATE ON data_export_requests
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        varchar NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  row_version   integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_deletion_requests_pending
  ON account_deletion_requests (user_id) WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_account_deletion_requests_bump_row_version ON account_deletion_requests;
CREATE TRIGGER trg_account_deletion_requests_bump_row_version
  BEFORE UPDATE ON account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['data_export_requests', 'account_deletion_requests'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_select', v_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = current_tenant_id())',
      v_table || '_select', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_insert', v_table);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_id = current_tenant_id())',
      v_table || '_insert', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_update', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())',
      v_table || '_update', v_table);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON data_export_requests, account_deletion_requests TO field_app;

-- ── Export worker queue (cross-tenant, like the indexing worker in 0036) ──
-- Claims the oldest queued export; a 'running' one untouched for 30
-- minutes is assumed abandoned (process died) and claimed again.
CREATE OR REPLACE FUNCTION claim_data_export_request()
RETURNS TABLE (id uuid, tenant_id uuid, user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE data_export_requests r
  SET status = 'running', started_at = now()
  WHERE r.id = (
    SELECT q.id FROM data_export_requests q
    WHERE q.status = 'queued'
       OR (q.status = 'running' AND q.started_at < now() - interval '30 minutes')
    ORDER BY q.requested_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING r.id, r.tenant_id, r.user_id;
$$;

CREATE OR REPLACE FUNCTION finish_data_export_request(
  p_id uuid, p_storage_key varchar, p_size_bytes bigint, p_expires_at timestamptz, p_error text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE data_export_requests
  SET status = CASE WHEN p_error IS NULL THEN 'ready' ELSE 'failed' END,
      storage_key = p_storage_key,
      size_bytes = p_size_bytes,
      expires_at = p_expires_at,
      error = p_error,
      completed_at = now()
  WHERE id = p_id;
$$;

-- Ready exports past their expiry: marks them expired and hands back the
-- keys so the worker can delete the files.
CREATE OR REPLACE FUNCTION expire_data_export_requests()
RETURNS TABLE (tenant_id uuid, storage_key varchar)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE data_export_requests
  SET status = 'expired'
  WHERE status = 'ready' AND expires_at < now()
  RETURNING tenant_id, storage_key;
$$;

REVOKE ALL ON FUNCTION claim_data_export_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_data_export_request(uuid, varchar, bigint, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_data_export_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_data_export_request() TO field_app, field_service;
GRANT EXECUTE ON FUNCTION finish_data_export_request(uuid, varchar, bigint, timestamptz, text) TO field_app, field_service;
GRANT EXECUTE ON FUNCTION expire_data_export_requests() TO field_app, field_service;

INSERT INTO schema_migrations (version)
VALUES ('0049_my_data_requests')
ON CONFLICT (version) DO NOTHING;
