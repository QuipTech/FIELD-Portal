-- Section 1e: contact phone number on users. Collected (required) when a
-- first-time Google/Apple user completes their signup profile; nullable
-- because existing users were created without one.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number varchar;

INSERT INTO schema_migrations (version)
VALUES ('0024_users_phone_number')
ON CONFLICT (version) DO NOTHING;
