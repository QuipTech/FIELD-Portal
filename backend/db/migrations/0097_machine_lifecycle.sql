-- Section 8e: machine lifecycle and activation (FIELD billing spec
-- section 4). Every machine keeps its permanent id and is registered,
-- active, archived or sold; only active machines are billed, through
-- activation intervals on the billing account. Existing machines start
-- registered, so nobody is billed until an administrator activates them.

-- ── Permissions and the organisation administrator role ────────────────
INSERT INTO permissions (code, description) VALUES
  ('billing.manage', 'Manage the organisation''s billing, plan and TECH seats'),
  ('machine.lifecycle', 'Activate, deactivate, archive, reactivate and transfer machines')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (name, is_system_role, is_default, tenant_id)
SELECT 'Organisation Admin', true, true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM roles
  WHERE name = 'Organisation Admin' AND is_system_role AND tenant_id IS NULL AND deleted_at IS NULL
);

INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code IN (
  'billing.manage', 'machine.lifecycle', 'machine.view', 'machine.create',
  'machine.manage', 'admin.manage_users', 'history.create', 'ai.use', 'support.create'
)
WHERE r.name = 'Organisation Admin' AND r.is_system_role AND r.tenant_id IS NULL AND r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Owner holds every permission.
INSERT INTO role_permissions (role_id, permission_id, tenant_id)
SELECT r.id, p.id, NULL
FROM roles r
JOIN permissions p ON p.code IN ('billing.manage', 'machine.lifecycle')
WHERE r.name = 'Owner' AND r.is_system_role AND r.tenant_id IS NULL AND r.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ── Lifecycle state ────────────────────────────────────────────────────
-- Separate from status, which is the operating status (running/down).
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS lifecycle_state varchar NOT NULL DEFAULT 'registered';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_lifecycle_state_check') THEN
    ALTER TABLE machines ADD CONSTRAINT machines_lifecycle_state_check
      CHECK (lifecycle_state IN ('registered', 'active', 'archived', 'sold'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_machines_tenant_lifecycle
  ON machines (tenant_id, lifecycle_state) WHERE deleted_at IS NULL;

-- ── Activation intervals ───────────────────────────────────────────────
-- A machine counts on day d when activated_on <= d and (billing_end is
-- null or d < billing_end). billing_end = first day of the month after
-- the deactivation, archive or sale. At most one open interval a machine.
CREATE TABLE IF NOT EXISTS billing.machine_activations (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id                 uuid NOT NULL REFERENCES machines(id),
  billing_account_id         uuid NOT NULL REFERENCES billing.billing_accounts(id),
  activated_on               date NOT NULL,
  deactivation_requested_at  timestamptz,
  billing_end                date CHECK (billing_end > activated_on),
  actor_user_id              uuid REFERENCES users(id) ON DELETE SET NULL,
  reason                     text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  row_version                integer NOT NULL DEFAULT 1,
  deleted_at                 timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_activations_open
  ON billing.machine_activations (machine_id)
  WHERE billing_end IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_machine_activations_account
  ON billing.machine_activations (billing_account_id, activated_on);

-- Lifecycle history for the machine page: actor, time, from, to, reason.
CREATE TABLE IF NOT EXISTS billing.machine_lifecycle_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id     uuid NOT NULL REFERENCES machines(id),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  from_state     varchar NOT NULL,
  to_state       varchar NOT NULL,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  reason         text,
  transfer_id    uuid,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  row_version    integer NOT NULL DEFAULT 1,
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_machine_lifecycle_events_machine
  ON billing.machine_lifecycle_events (machine_id, occurred_at DESC);

-- ── Transfers (sale between organisations) ─────────────────────────────
-- Requested by the owning organisation, approved or rejected by the
-- receiving one. Completed transfers are the machine's chain of custody.
CREATE TABLE IF NOT EXISTS billing.machine_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id      uuid NOT NULL REFERENCES machines(id),
  from_tenant_id  uuid NOT NULL REFERENCES tenants(id),
  to_tenant_id    uuid NOT NULL REFERENCES tenants(id) CHECK (to_tenant_id <> from_tenant_id),
  status          varchar NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'rejected', 'cancelled', 'completed')),
  reason          text NOT NULL,
  -- Label, serial, make and model when requested: the receiving
  -- organisation can't read the machine itself until the transfer completes.
  machine_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  row_version     integer NOT NULL DEFAULT 1,
  deleted_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_transfers_pending
  ON billing.machine_transfers (machine_id)
  WHERE status = 'requested' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_machine_transfers_to_tenant
  ON billing.machine_transfers (to_tenant_id, status);

-- ── Review tasks (QuipTech or the partner) ─────────────────────────────
-- One open task per account and type, so a repeated trigger (another
-- activation past the threshold) never raises a second one.
CREATE TABLE IF NOT EXISTS billing.review_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id  uuid NOT NULL REFERENCES billing.billing_accounts(id),
  type                varchar NOT NULL
                        CHECK (type IN ('plan_review', 'enterprise_threshold', 'abuse_flag')),
  reason              text NOT NULL,
  status              varchar NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  notes               text,
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  row_version         integer NOT NULL DEFAULT 1,
  deleted_at          timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_tasks_open_type
  ON billing.review_tasks (billing_account_id, type)
  WHERE status IN ('open', 'in_progress') AND deleted_at IS NULL;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['machine_activations', 'machine_lifecycle_events', 'machine_transfers', 'review_tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON billing.%I', 'trg_' || v_table || '_bump_row_version', v_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON billing.%I FOR EACH ROW EXECUTE FUNCTION bump_row_version()',
      'trg_' || v_table || '_bump_row_version', v_table);
  END LOOP;
END
$$;

-- ── RLS ────────────────────────────────────────────────────────────────
-- Activations: own billing account. Lifecycle events: own organisation.
-- Transfers: both the sending and the receiving organisation. Review
-- tasks are QuipTech's: service role only.
DO $$
DECLARE
  v_table text;
  v_own_rows text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['machine_activations', 'machine_lifecycle_events', 'machine_transfers'] LOOP
    v_own_rows := CASE v_table
      WHEN 'machine_activations' THEN 'billing_account_id = current_billing_account_id()'
      WHEN 'machine_lifecycle_events' THEN 'tenant_id = current_tenant_id()'
      ELSE 'from_tenant_id = current_tenant_id() OR to_tenant_id = current_tenant_id()'
    END;
    EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_own_select', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR SELECT TO field_app USING (%s)',
      v_table || '_own_select', v_table, v_own_rows);
    EXECUTE format('DROP POLICY IF EXISTS %I ON billing.%I', v_table || '_service_all', v_table);
    EXECUTE format('CREATE POLICY %I ON billing.%I FOR ALL TO field_service USING (true) WITH CHECK (true)',
      v_table || '_service_all', v_table);
  END LOOP;
END
$$;

REVOKE ALL ON billing.machine_activations, billing.machine_lifecycle_events,
  billing.machine_transfers, billing.review_tasks FROM PUBLIC, field_app;
GRANT SELECT ON billing.machine_activations, billing.machine_lifecycle_events,
  billing.machine_transfers TO field_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing.machine_activations,
  billing.machine_lifecycle_events, billing.machine_transfers,
  billing.review_tasks TO field_service;

-- ── One lifecycle transition, atomically ───────────────────────────────
-- The backend decides whether the transition is allowed and works out the
-- billing days; this applies it: the state change (only if the machine is
-- still in p_from, so two admins can't race), the activation interval and
-- the history row. NULL = the machine isn't in that organisation or has
-- moved on from p_from. machines is RLS-scoped per tenant, so this is
-- SECURITY DEFINER, callable by the service role only.
CREATE OR REPLACE FUNCTION billing.apply_machine_transition(
  p_machine_id          uuid,
  p_tenant_id           uuid,
  p_billing_account_id  uuid,
  p_from_state          varchar,
  p_to_state            varchar,
  p_activated_on        date,
  p_billing_end         date,
  p_actor_user_id       uuid,
  p_reason              text,
  p_transfer_id         uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  UPDATE machines SET lifecycle_state = p_to_state
  WHERE id = p_machine_id AND tenant_id = p_tenant_id
    AND lifecycle_state = p_from_state AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_from_state = 'active' THEN
    UPDATE billing.machine_activations
    SET billing_end = p_billing_end, deactivation_requested_at = now(), updated_at = now()
    WHERE machine_id = p_machine_id AND billing_end IS NULL AND deleted_at IS NULL;
  END IF;

  IF p_to_state = 'active' THEN
    INSERT INTO billing.machine_activations
      (machine_id, billing_account_id, activated_on, actor_user_id, reason)
    VALUES (p_machine_id, p_billing_account_id, p_activated_on, p_actor_user_id, p_reason);
  END IF;

  INSERT INTO billing.machine_lifecycle_events
    (machine_id, tenant_id, from_state, to_state, actor_user_id, reason, transfer_id)
  VALUES (p_machine_id, p_tenant_id, p_from_state, p_to_state, p_actor_user_id, p_reason, p_transfer_id)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION billing.apply_machine_transition(uuid, uuid, uuid, varchar, varchar, date, date, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.apply_machine_transition(uuid, uuid, uuid, varchar, varchar, date, date, uuid, text, uuid) TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0097_machine_lifecycle')
ON CONFLICT (version) DO NOTHING;
