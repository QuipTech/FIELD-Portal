-- Machine Control, "Send to tablet": a Portal person sends files to one
-- machine's tablet. Each send is an ordinary design delivery (0134), so the
-- tablet needs nothing new; this adds:
--   * a 'file_transfer' history entry per send, in the machine's owning
--     organisation, whose file list and status come from the delivery;
--   * a design:available announcement for every new delivery, so a connected
--     tablet fetches at once instead of at its next poll.

ALTER TABLE technical_history_entries
  ADD COLUMN IF NOT EXISTS design_delivery_id uuid REFERENCES mc_design_deliveries(id);
ALTER TABLE technical_history_entries DROP CONSTRAINT IF EXISTS technical_history_entries_entry_type_check;
ALTER TABLE technical_history_entries ADD CONSTRAINT technical_history_entries_entry_type_check
  CHECK (entry_type IN ('service', 'repair', 'inspection', 'note', 'fault', 'remote_session', 'file_transfer'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_technical_history_entries_design_delivery
  ON technical_history_entries (design_delivery_id) WHERE design_delivery_id IS NOT NULL;

-- One delivery's files and where it stands, for anyone who can see its
-- machine (a shared organisation that neither sent nor owns it too). A
-- delivery still pending for a removed tablet can never arrive: failed.
CREATE OR REPLACE FUNCTION mc_file_send(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', d.id,
    'sendId', d.batch_id,
    'status', CASE WHEN d.status IN ('waiting', 'downloading') AND md.id IS NULL
      THEN 'failed' ELSE d.status END,
    'error', CASE WHEN d.status IN ('waiting', 'downloading') AND md.id IS NULL
      THEN 'The tablet was disconnected. Send again after adding a tablet.' ELSE d.error END,
    'createdAt', d.created_at,
    'updatedAt', d.updated_at,
    'files', (SELECT jsonb_agg(jsonb_build_object(
        'name', f.file->>'path', 'sizeBytes', (f.file->>'sizeBytes')::bigint) ORDER BY f.position)
      FROM jsonb_array_elements(v.files) WITH ORDINALITY AS f(file, position)))
  FROM mc_design_deliveries d
  JOIN mc_design_versions v ON v.id = d.version_id
  LEFT JOIN mc_devices md ON md.id = d.device_id
    AND md.disabled_at IS NULL AND md.deleted_at IS NULL
  WHERE d.id = p_delivery_id
    AND d.machine_id IN (SELECT machine_id FROM accessible_machines());
$$;
REVOKE ALL ON FUNCTION mc_file_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mc_file_send(uuid) TO field_app;

-- Sent on commit through 'mc_device_event' (0128) to the tablet's room.
CREATE OR REPLACE FUNCTION mc_design_delivery_announce()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM mc_announce(jsonb_build_object('event', 'design:available',
    'deviceId', NEW.device_id, 'machineId', NEW.machine_id, 'deliveryId', NEW.id));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_mc_design_delivery_announce ON mc_design_deliveries;
CREATE TRIGGER trg_mc_design_delivery_announce
  AFTER INSERT ON mc_design_deliveries
  FOR EACH ROW EXECUTE FUNCTION mc_design_delivery_announce();

INSERT INTO schema_migrations (version)
VALUES ('0144_mc_send_to_tablet')
ON CONFLICT (version) DO NOTHING;
