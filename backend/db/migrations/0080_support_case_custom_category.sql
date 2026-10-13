-- "Something else" cases carry the reporter's own name for the type
-- (e.g. "Warranty claim"), shown with the case. NULL for every other type.

ALTER TABLE support_cases
  ADD COLUMN IF NOT EXISTS custom_category varchar(80);

INSERT INTO schema_migrations (version)
VALUES ('0080_support_case_custom_category')
ON CONFLICT (version) DO NOTHING;
