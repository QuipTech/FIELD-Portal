-- One invoice can now cover several months of a machine's final charge, so that
-- a customer pays everything not yet invoiced in one go. Each month keeps its own
-- row, because the monthly run leaves the machine out of that month's peak.

ALTER TABLE billing.machine_final_charges
  DROP CONSTRAINT IF EXISTS machine_final_charges_invoice_id_key;
DROP INDEX IF EXISTS billing.uq_machine_final_charges_invoice_month;
CREATE UNIQUE INDEX uq_machine_final_charges_invoice_month
  ON billing.machine_final_charges (invoice_id, period_start);

INSERT INTO schema_migrations (version)
VALUES ('0126_machine_final_charge_months')
ON CONFLICT (version) DO NOTHING;
