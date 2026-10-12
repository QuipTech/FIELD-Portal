-- Section 1r: Bedrock usage that isn't a technician's answer — prompt
-- Test runs, document indexing (embeddings) and search-query embeddings.
-- Kept apart from ai_usage_log, whose rows each belong to a user and an
-- assistant message. Shown on Admin → AI configuration next to the
-- assistant figures. An estimate only: AWS billing is the source of truth.

CREATE TABLE IF NOT EXISTS ai_platform_usage_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for platform work: prompt tests and shared-library documents.
  tenant_id      uuid REFERENCES tenants(id),
  source         text NOT NULL CHECK (source IN ('prompt_test', 'indexing', 'search')),
  model_id       text NOT NULL,
  input_tokens   integer NOT NULL,
  output_tokens  integer NOT NULL,
  cost_estimate  double precision NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_log_created_at ON ai_platform_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_log_tenant_id ON ai_platform_usage_log(tenant_id);

ALTER TABLE ai_platform_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_platform_usage_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_platform_usage_log_select ON ai_platform_usage_log;
CREATE POLICY ai_platform_usage_log_select ON ai_platform_usage_log
  FOR SELECT USING (tenant_id = current_tenant_id());

-- Written only through record_ai_platform_usage: the indexing worker runs
-- outside any request and shared documents have no tenant.
REVOKE INSERT, UPDATE, DELETE ON ai_platform_usage_log FROM field_app;

CREATE OR REPLACE FUNCTION record_ai_platform_usage(
  p_tenant_id uuid, p_source text, p_model_id text,
  p_input_tokens integer, p_output_tokens integer, p_cost_estimate double precision
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO ai_platform_usage_log
    (tenant_id, source, model_id, input_tokens, output_tokens, cost_estimate)
  VALUES (p_tenant_id, p_source, p_model_id, p_input_tokens, p_output_tokens, p_cost_estimate);
$$;

-- One row per source for the period. p_tenant_id NULL (the Owner) covers
-- everything; an organisation sees only its own documents and searches.
CREATE OR REPLACE FUNCTION admin_ai_platform_usage(p_tenant_id uuid, p_days integer)
RETURNS TABLE (
  source text, call_count bigint, input_tokens bigint,
  output_tokens bigint, total_cost double precision
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT l.source, count(*), COALESCE(sum(l.input_tokens), 0),
         COALESCE(sum(l.output_tokens), 0), COALESCE(sum(l.cost_estimate), 0)
  FROM ai_platform_usage_log l
  WHERE l.created_at >= now() - make_interval(days => p_days)
    AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
  GROUP BY l.source
  ORDER BY l.source;
$$;

REVOKE ALL ON FUNCTION record_ai_platform_usage(uuid, text, text, integer, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_ai_platform_usage(uuid, text, text, integer, integer, double precision) TO field_app;
REVOKE ALL ON FUNCTION admin_ai_platform_usage(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_ai_platform_usage(uuid, integer) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0063_ai_platform_usage')
ON CONFLICT (version) DO NOTHING;
