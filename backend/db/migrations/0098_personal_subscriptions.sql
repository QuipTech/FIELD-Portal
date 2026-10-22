-- Personal TECH payment is separate from the organisation's fleet account.
CREATE TABLE IF NOT EXISTS billing.personal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL UNIQUE REFERENCES billing.billing_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  row_version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS billing.personal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing.billing_accounts(id),
  price_book_id uuid NOT NULL REFERENCES billing.price_books(id),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end > period_start),
  invoice_id uuid NOT NULL UNIQUE REFERENCES billing.invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  row_version integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, period_start)
);

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['personal_accounts', 'personal_periods'] LOOP
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS personal_own_select ON billing.%I', v_table);
    EXECUTE format(
      'CREATE POLICY personal_own_select ON billing.%I FOR SELECT TO field_app USING
       (tenant_id = current_tenant_id() AND user_id = nullif(current_setting(''app.user_id'', true), '''')::uuid)',
      v_table);
    EXECUTE format('DROP POLICY IF EXISTS personal_service_all ON billing.%I', v_table);
    EXECUTE format('CREATE POLICY personal_service_all ON billing.%I FOR ALL TO field_service USING (true) WITH CHECK (true)', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS personal_bump_row_version ON billing.%I', v_table);
    EXECUTE format('CREATE TRIGGER personal_bump_row_version BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()', v_table);
    EXECUTE format('REVOKE ALL ON billing.%I FROM PUBLIC, field_app', v_table);
    EXECUTE format('GRANT SELECT ON billing.%I TO field_app', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON billing.%I TO field_service', v_table);
  END LOOP;
END $$;

INSERT INTO schema_migrations (version) VALUES ('0098_personal_subscriptions')
ON CONFLICT (version) DO NOTHING;
