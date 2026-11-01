-- Section 1p: which machines a person sees.
--   * users.machine_access_mode: 'all' (every machine in the organisation,
--     the default, so nothing changes for existing people) or 'selected'
--     (only machines in their groups; ungrouped machines are hidden).
--     Organisation admins and the platform administrator always see every
--     machine, whatever is stored here (the backend decides from
--     permissions).
--   * user_machine_group_access: a 'selected' person's groups. Rows are
--     hard-deleted (like machine_assignments) and go with the person or
--     when their group is deleted. Both foreign keys include tenant_id, so
--     a person can't be given another organisation's group.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS machine_access_mode varchar NOT NULL DEFAULT 'all';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_machine_access_mode_check;
ALTER TABLE users ADD CONSTRAINT users_machine_access_mode_check
  CHECK (machine_access_mode IN ('all', 'selected'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_id_id ON users (tenant_id, id);

CREATE TABLE IF NOT EXISTS user_machine_group_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL,
  group_id    uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, group_id) REFERENCES machine_groups (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_user_machine_group_access_user
  ON user_machine_group_access (user_id);
CREATE INDEX IF NOT EXISTS idx_user_machine_group_access_group
  ON user_machine_group_access (group_id);

ALTER TABLE user_machine_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_machine_group_access FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_machine_group_access_all ON user_machine_group_access;
CREATE POLICY user_machine_group_access_all ON user_machine_group_access
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, DELETE ON user_machine_group_access TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0114_user_machine_group_access')
ON CONFLICT (version) DO NOTHING;
