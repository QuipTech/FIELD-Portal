-- ── Complete an approved machine transfer, atomically ─────────────────
-- The receiving organisation approved (billing spec section 4). The machine
-- leaves the seller as sold: their billing interval ends on p_billing_end.
-- It arrives with the buyer as registered (free until they activate it).
-- Machine facts move: the machine record, its installed systems and
-- components, and its configuration snapshots. The seller's own numbers,
-- site and people (fleet/asset number, site, created_by, taken_by) are
-- cleared. History, resolutions, photos, support cases, AI conversations,
-- status events and component replacements stay with the seller.
-- false = the transfer isn't pending or the machine has left active.
-- machines and the moved tables are RLS-scoped per tenant, so this is
-- SECURITY DEFINER, callable by the service role only.
CREATE OR REPLACE FUNCTION billing.complete_machine_transfer(
  p_transfer_id    uuid,
  p_billing_end    date,
  p_actor_user_id  uuid,
  p_reason         text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer billing.machine_transfers%ROWTYPE;
BEGIN
  SELECT * INTO v_transfer FROM billing.machine_transfers
  WHERE id = p_transfer_id AND status = 'requested' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE machines
  SET tenant_id = v_transfer.to_tenant_id, lifecycle_state = 'registered',
      fleet_number = NULL, asset_number = NULL, site = NULL, created_by = NULL,
      updated_at = now()
  WHERE id = v_transfer.machine_id AND tenant_id = v_transfer.from_tenant_id
    AND lifecycle_state = 'active' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE billing.machine_activations
  SET billing_end = p_billing_end, deactivation_requested_at = now(), updated_at = now()
  WHERE machine_id = v_transfer.machine_id AND billing_end IS NULL AND deleted_at IS NULL;

  UPDATE installed_components SET tenant_id = v_transfer.to_tenant_id
  WHERE tenant_id = v_transfer.from_tenant_id
    AND installed_system_id IN (
      SELECT id FROM installed_systems WHERE machine_id = v_transfer.machine_id);
  UPDATE installed_systems SET tenant_id = v_transfer.to_tenant_id
  WHERE machine_id = v_transfer.machine_id AND tenant_id = v_transfer.from_tenant_id;

  UPDATE configuration_snapshot_items SET tenant_id = v_transfer.to_tenant_id
  WHERE tenant_id = v_transfer.from_tenant_id
    AND snapshot_id IN (
      SELECT id FROM configuration_snapshots WHERE machine_id = v_transfer.machine_id);
  UPDATE configuration_snapshots
  SET tenant_id = v_transfer.to_tenant_id, taken_by = NULL
  WHERE machine_id = v_transfer.machine_id AND tenant_id = v_transfer.from_tenant_id;

  INSERT INTO billing.machine_lifecycle_events
    (machine_id, tenant_id, from_state, to_state, actor_user_id, reason, transfer_id)
  VALUES
    (v_transfer.machine_id, v_transfer.from_tenant_id, 'active', 'sold',
     p_actor_user_id, p_reason, p_transfer_id),
    (v_transfer.machine_id, v_transfer.to_tenant_id, 'sold', 'registered',
     p_actor_user_id, 'Received by transfer', p_transfer_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION billing.complete_machine_transfer(uuid, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing.complete_machine_transfer(uuid, date, uuid, text) TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0100_complete_machine_transfer')
ON CONFLICT (version) DO NOTHING;
