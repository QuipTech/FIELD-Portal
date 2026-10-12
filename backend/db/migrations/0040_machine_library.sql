-- Section 2c: the admin Machine library — each machine model's system &
-- component template ("Powertrain → Engine — C175-16"), reused by every
-- asset instance of the model. Like machine_manufacturers/machine_models
-- (0006) this is shared reference data across all tenants, so there's no
-- tenant_id/RLS; the backend's Owner-only guard is what restricts writes.

-- Names are unique among live rows only, so a soft-deleted model,
-- system or component's name can be reused.
ALTER TABLE machine_models
  DROP CONSTRAINT IF EXISTS machine_models_manufacturer_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_models_live_name
  ON machine_models (manufacturer_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS model_systems (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_model_id  uuid NOT NULL REFERENCES machine_models(id),
  name              varchar NOT NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  row_version       integer NOT NULL DEFAULT 1,
  deleted_at        timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_systems_live_name
  ON model_systems (machine_model_id, lower(name))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_model_systems_bump_row_version ON model_systems;
CREATE TRIGGER trg_model_systems_bump_row_version
  BEFORE UPDATE ON model_systems
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

CREATE TABLE IF NOT EXISTS model_components (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_system_id  uuid NOT NULL REFERENCES model_systems(id),
  name             varchar NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  row_version      integer NOT NULL DEFAULT 1,
  deleted_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_components_live_name
  ON model_components (model_system_id, lower(name))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_model_components_bump_row_version ON model_components;
CREATE TRIGGER trg_model_components_bump_row_version
  BEFORE UPDATE ON model_components
  FOR EACH ROW EXECUTE FUNCTION bump_row_version();

-- Tables created before 0002's default privileges can miss field_app
-- grants on some setups; these are explicit so the library always works.
GRANT SELECT, INSERT, UPDATE ON machine_manufacturers, machine_models,
  model_systems, model_components TO field_app;

-- The Machine library's model list. SECURITY DEFINER because assets_count
-- counts machines across every tenant, which RLS would otherwise hide.
-- p_model_id NULL lists every live model (optionally filtered by
-- p_search against "<manufacturer> <model>" and the category).
CREATE OR REPLACE FUNCTION admin_list_machine_models(
  p_search    varchar DEFAULT NULL,
  p_model_id  uuid DEFAULT NULL
)
RETURNS TABLE (
  id                 uuid,
  manufacturer_name  varchar,
  name               varchar,
  product_family     varchar,
  systems_count      bigint,
  assets_count       bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT mm.id, mf.name, mm.name, mm.product_family,
         (SELECT count(*) FROM model_systems ms
           WHERE ms.machine_model_id = mm.id AND ms.deleted_at IS NULL),
         (SELECT count(*) FROM machines m
           WHERE m.model_id = mm.id AND m.deleted_at IS NULL)
  FROM machine_models mm
  JOIN machine_manufacturers mf ON mf.id = mm.manufacturer_id
  WHERE mm.deleted_at IS NULL
    AND (p_model_id IS NULL OR mm.id = p_model_id)
    AND (p_search IS NULL
         OR (mf.name || ' ' || mm.name) ILIKE '%' || p_search || '%'
         OR mm.product_family ILIKE '%' || p_search || '%')
  ORDER BY mf.name, mm.name;
$$;

REVOKE ALL ON FUNCTION admin_list_machine_models(varchar, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_machine_models(varchar, uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0040_machine_library')
ON CONFLICT (version) DO NOTHING;
