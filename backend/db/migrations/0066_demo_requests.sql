-- Section 1t: demo requests from the marketing site (quiptechfield.com.au).
-- POST /public/demo-requests saves one row per form submission; the team
-- follows up by email and the Owner tracks each request in the admin
-- portal. Platform-wide, so no tenant_id and no RLS.
--
-- Unlike the rest of the platform schema (plan catalogue, read by every
-- tenant), these rows are sales leads with personal details: only the
-- service role (field_service) can read or write them. 0046 grants SELECT
-- on every platform table to field_app, and migrations are re-run as a
-- set, so the REVOKE below must stay after it.

CREATE TABLE IF NOT EXISTS platform.demo_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                varchar(320) NOT NULL,
  first_name           varchar(100) NOT NULL,
  last_name            varchar(100) NOT NULL,
  company              varchar(200) NOT NULL,
  country              varchar(100) NOT NULL,
  phone                varchar(30),
  message              varchar(2000),
  status               text NOT NULL DEFAULT 'new' CHECK (status IN (
                         'new', 'contacted', 'scheduled', 'completed', 'converted', 'lost'
                       )),
  -- The team's own notes, edited in the admin portal.
  notes                text,
  -- NULL until that email was actually sent (a failed or switched-off
  -- send leaves it NULL, so "Resend emails" picks it up).
  team_email_sent_at   timestamptz,
  user_email_sent_at   timestamptz,
  -- As the API saw it (req.ip); NULL if the connection had already closed.
  ip_address           varchar(45),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at
  ON platform.demo_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status
  ON platform.demo_requests (status);

REVOKE ALL ON platform.demo_requests FROM PUBLIC, field_app;
GRANT SELECT, INSERT, UPDATE ON platform.demo_requests TO field_service;

INSERT INTO schema_migrations (version)
VALUES ('0066_demo_requests')
ON CONFLICT (version) DO NOTHING;
