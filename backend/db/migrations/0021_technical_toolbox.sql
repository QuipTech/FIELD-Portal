-- Section 6: Technical Toolbox. toolbox_items is a shared platform
-- library (like machine_manufacturers/models) — the calculators
-- themselves aren't tenant data, so no tenant_id/RLS there. Results and
-- favourites belong to a tenant's users.

CREATE TABLE IF NOT EXISTS toolbox_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar NOT NULL,
  category     varchar,
  description  text,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  row_version  integer NOT NULL DEFAULT 1,
  deleted_at   timestamptz
);

DROP TRIGGER IF EXISTS trg_toolbox_items_bump_row_version ON toolbox_items;
CREATE TRIGGER trg_toolbox_items_bump_row_version
  BEFORE UPDATE ON toolbox_items
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS calculator_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  toolbox_item_id  uuid NOT NULL REFERENCES toolbox_items(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  input_data       jsonb NOT NULL,
  result_data      jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculator_results_tenant_id ON calculator_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_user_id ON calculator_results(user_id);

ALTER TABLE calculator_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calculator_results_select ON calculator_results;
CREATE POLICY calculator_results_select ON calculator_results
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS calculator_results_insert ON calculator_results;
CREATE POLICY calculator_results_insert ON calculator_results
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE TABLE IF NOT EXISTS user_favourite_tools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  user_id          uuid NOT NULL REFERENCES users(id),
  toolbox_item_id  uuid NOT NULL REFERENCES toolbox_items(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, toolbox_item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favourite_tools_tenant_id ON user_favourite_tools(tenant_id);

ALTER TABLE user_favourite_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favourite_tools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_favourite_tools_select ON user_favourite_tools;
CREATE POLICY user_favourite_tools_select ON user_favourite_tools
  FOR SELECT USING (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS user_favourite_tools_insert ON user_favourite_tools;
CREATE POLICY user_favourite_tools_insert ON user_favourite_tools
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
DROP POLICY IF EXISTS user_favourite_tools_delete ON user_favourite_tools;
CREATE POLICY user_favourite_tools_delete ON user_favourite_tools
  FOR DELETE USING (tenant_id = current_tenant_id());

-- A favourite is a toggle, not a business record — unlike everything else
-- in this schema it's fine to hard-delete, so field_app needs the grant.
GRANT DELETE ON user_favourite_tools TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0021_technical_toolbox')
ON CONFLICT (version) DO NOTHING;
