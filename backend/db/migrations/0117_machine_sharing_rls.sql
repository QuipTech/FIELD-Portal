-- Section 2g (continued): RLS lets a shared machine and its child rows be
-- read across organisations ONLY through an active assignment
-- (shared_machine_access(), 0116). Rows stay in the owning organisation:
--   * read: own organisation, or a machine shared with the current person
--     (history and attachments, photos, configuration snapshots and items,
--     installed systems and components, component replacements, status
--     events). Support cases on a shared machine are readable only when
--     raised by someone in the reader's own organisation (users RLS limits
--     the creator check to them), with their messages and attachments.
--   * write: 'contribute' adds history (with attachments), photos and
--     cases (with messages and attachments) that belong to the machine's
--     owning organisation. Nothing else changes: the machine record,
--     lifecycle, billing, assignments and users stay own-organisation only.

DROP POLICY IF EXISTS machines_select ON machines;
CREATE POLICY machines_select ON machines FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR id IN (SELECT machine_id FROM shared_machine_access()));

-- Child rows with a machine_id column.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'technical_history_entries', 'machine_photos', 'configuration_snapshots',
    'installed_systems', 'machine_status_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = current_tenant_id()
         OR machine_id IN (SELECT machine_id FROM shared_machine_access()))',
      v_table || '_select', v_table);
  END LOOP;
END
$$;

-- Child rows of those children: visible when their parent is.
DROP POLICY IF EXISTS technical_attachments_select ON technical_attachments;
CREATE POLICY technical_attachments_select ON technical_attachments FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR history_entry_id IN (SELECT id FROM technical_history_entries));
DROP POLICY IF EXISTS configuration_snapshot_items_select ON configuration_snapshot_items;
CREATE POLICY configuration_snapshot_items_select ON configuration_snapshot_items FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR snapshot_id IN (SELECT id FROM configuration_snapshots));
DROP POLICY IF EXISTS installed_components_select ON installed_components;
CREATE POLICY installed_components_select ON installed_components FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR installed_system_id IN (SELECT id FROM installed_systems));
DROP POLICY IF EXISTS component_replacement_records_select ON component_replacement_records;
CREATE POLICY component_replacement_records_select ON component_replacement_records FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR installed_component_id IN (SELECT id FROM installed_components));

-- Cases: on a shared machine, only those raised by the reader's own
-- organisation (users RLS returns only its people).
DROP POLICY IF EXISTS support_cases_select ON support_cases;
CREATE POLICY support_cases_select ON support_cases FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR (machine_id IN (SELECT machine_id FROM shared_machine_access())
        AND created_by IN (SELECT id FROM users)));
DROP POLICY IF EXISTS support_updates_select ON support_updates;
CREATE POLICY support_updates_select ON support_updates FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR support_case_id IN (SELECT id FROM support_cases));
DROP POLICY IF EXISTS support_attachments_select ON support_attachments;
CREATE POLICY support_attachments_select ON support_attachments FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR support_case_id IN (SELECT id FROM support_cases));
DROP POLICY IF EXISTS case_events_select ON case_events;
CREATE POLICY case_events_select ON case_events FOR SELECT
  USING (tenant_id = current_tenant_id()
    OR support_case_id IN (SELECT id FROM support_cases));

-- 'contribute' writes, into the machine's owning organisation.
DROP POLICY IF EXISTS technical_history_entries_insert ON technical_history_entries;
CREATE POLICY technical_history_entries_insert ON technical_history_entries FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id()
    OR (created_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)));
DROP POLICY IF EXISTS machine_photos_insert ON machine_photos;
CREATE POLICY machine_photos_insert ON machine_photos FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id()
    OR (uploaded_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)));
DROP POLICY IF EXISTS technical_attachments_insert ON technical_attachments;
CREATE POLICY technical_attachments_insert ON technical_attachments FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR EXISTS (
    SELECT 1 FROM technical_history_entries h
    WHERE h.id = history_entry_id AND h.tenant_id = technical_attachments.tenant_id
      AND h.created_by = current_app_user_id()
      AND can_contribute_to_machine(h.machine_id, h.tenant_id)));
DROP POLICY IF EXISTS support_cases_insert ON support_cases;
CREATE POLICY support_cases_insert ON support_cases FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id()
    OR (created_by = current_app_user_id()
        AND can_contribute_to_machine(machine_id, tenant_id)));
-- Replying to their own organisation's case updates it (status, times).
DROP POLICY IF EXISTS support_cases_update ON support_cases;
CREATE POLICY support_cases_update ON support_cases FOR UPDATE
  USING (tenant_id = current_tenant_id()
    OR (can_contribute_to_machine(machine_id, tenant_id)
        AND created_by IN (SELECT id FROM users)))
  WITH CHECK (tenant_id = current_tenant_id()
    OR (can_contribute_to_machine(machine_id, tenant_id)
        AND created_by IN (SELECT id FROM users)));
DROP POLICY IF EXISTS support_updates_insert ON support_updates;
CREATE POLICY support_updates_insert ON support_updates FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR EXISTS (
    SELECT 1 FROM support_cases c
    WHERE c.id = support_case_id AND c.tenant_id = support_updates.tenant_id
      AND support_updates.created_by = current_app_user_id()
      AND can_contribute_to_machine(c.machine_id, c.tenant_id)));
DROP POLICY IF EXISTS case_events_insert ON case_events;
CREATE POLICY case_events_insert ON case_events FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR EXISTS (
    SELECT 1 FROM support_cases c
    WHERE c.id = support_case_id AND c.tenant_id = case_events.tenant_id
      AND case_events.actor_id = current_app_user_id()
      AND can_contribute_to_machine(c.machine_id, c.tenant_id)));
DROP POLICY IF EXISTS support_attachments_insert ON support_attachments;
CREATE POLICY support_attachments_insert ON support_attachments FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR EXISTS (
    SELECT 1 FROM support_cases c
    WHERE c.id = support_case_id AND c.tenant_id = support_attachments.tenant_id
      AND support_attachments.uploaded_by = current_app_user_id()
      AND can_contribute_to_machine(c.machine_id, c.tenant_id)));

INSERT INTO schema_migrations (version)
VALUES ('0117_machine_sharing_rls')
ON CONFLICT (version) DO NOTHING;
