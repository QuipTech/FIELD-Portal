-- A machine's final charge paid by bank transfer instead of Stripe online.
-- The customer chooses it before paying; the invoice is then sent through
-- Stripe with the bank details in its footer and never charged to a card,
-- and a platform administrator marks it paid (Billing → Mark as paid) once
-- the money arrives. Until then the machine can't be deleted.
ALTER TABLE billing.invoices
  ADD COLUMN IF NOT EXISTS pay_by_bank_transfer boolean NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version)
VALUES ('0137_invoice_bank_transfer')
ON CONFLICT (version) DO NOTHING;
