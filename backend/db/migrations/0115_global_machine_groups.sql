-- Section 2g: machine groups become GLOBAL, managed by the platform
-- administrator (Owner, platform.manage). A group can hold machines from
-- any organisation and be assigned to organisations or individual people,
-- who then see those machines (controlled cross-organisation access).
--   * machine_groups: kept in place (ids and audit history stay valid);
--     0117 drops its tenant_id once nothing references it. description
--     takes over from notes. Live names that clash across organisations
--     get the organisation's name, then a short id if that still clashes.
--   * machine_group_machines: which machines a group holds. A machine can
--     be in several groups; its owning organisation never changes.
--   * machine_group_assignments: who a group is shared with ('organisation'
--     or 'user'), at 'view' or 'contribute'. Revoked rows are kept.
--   * machine_share_exclusions: an owning organisation's admin withdrawing
--     ONE of its machines from one assignment, without touching the rest
--     of the group.
--   * users.machine_access_mode: 'all' (own organisation's machines plus
--     shared ones) or 'groups_only' (only machines in their groups);
--     'selected' people become 'groups_only' with a 'view' assignment to
--     each group they had.

ALTER TABLE machine_groups ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE machine_groups ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
UPDATE machine_groups SET description = notes WHERE description IS NULL AND notes IS NOT NULL;

WITH clashing AS (
  SELECT g.id, t.name AS tenant_name
  FROM machine_groups g JOIN tenants t ON t.id = g.tenant_id
  WHERE g.deleted_at IS NULL
    AND (SELECT count(*) FROM machine_groups o
         WHERE o.deleted_at IS NULL AND lower(o.name) = lower(g.name)) > 1
)
UPDATE machine_groups g SET name = g.name || ' (' || c.tenant_name || ')'
FROM clashing c WHERE c.id = g.id;

WITH still_clashing AS (
  SELECT g.id FROM machine_groups g
  WHERE g.deleted_at IS NULL
    AND (SELECT count(*) FROM machine_groups o
         WHERE o.deleted_at IS NULL AND lower(o.name) = lower(g.name)) > 1
)
UPDATE machine_groups g SET name = g.name || ' ' || left(g.id::text, 8)
FROM still_clashing c WHERE c.id = g.id;

CREATE TABLE IF NOT EXISTS machine_group_machines (
  group_id    uuid NOT NULL REFERENCES machine_groups(id),
  machine_id  uuid NOT NULL REFERENCES machines(id),
  added_by    uuid REFERENCES users(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, machine_id)
);
CREATE INDEX IF NOT EXISTS idx_machine_group_machines_machine
  ON machine_group_machines (machine_id);

INSERT INTO machine_group_machines (group_id, machine_id)
SELECT m.group_id, m.id
FROM machines m
JOIN machine_groups g ON g.id = m.group_id AND g.deleted_at IS NULL
WHERE m.group_id IS NOT NULL AND m.deleted_at IS NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS machine_group_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES machine_groups(id),
  target_type    varchar NOT NULL CHECK (target_type IN ('organisation', 'user')),
  target_id      uuid NOT NULL,
  access_level   varchar NOT NULL CHECK (access_level IN ('view', 'contribute')),
  granted_by     uuid REFERENCES users(id),
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES users(id),
  revoke_reason  text
);
-- One active assignment per group and target; changing the level updates it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_group_assignments_active
  ON machine_group_assignments (group_id, target_type, target_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_machine_group_assignments_target
  ON machine_group_assignments (target_type, target_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS machine_share_exclusions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid NOT NULL REFERENCES machine_group_assignments(id),
  machine_id     uuid NOT NULL REFERENCES machines(id),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  revoked_by     uuid NOT NULL REFERENCES users(id),
  reason         text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, machine_id)
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_machine_access_mode_check;
UPDATE users SET machine_access_mode = 'groups_only' WHERE machine_access_mode = 'selected';
ALTER TABLE users ADD CONSTRAINT users_machine_access_mode_check
  CHECK (machine_access_mode IN ('all', 'groups_only'));

INSERT INTO machine_group_assignments
  (group_id, target_type, target_id, access_level, granted_at)
SELECT a.group_id, 'user', a.user_id, 'view', a.created_at
FROM user_machine_group_access a
JOIN machine_groups g ON g.id = a.group_id AND g.deleted_at IS NULL
JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('0115_global_machine_groups')
ON CONFLICT (version) DO NOTHING;
