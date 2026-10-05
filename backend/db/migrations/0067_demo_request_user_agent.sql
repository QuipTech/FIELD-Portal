-- Section 1t (cont.): the browser's User-Agent on each demo request, saved
-- alongside the IP to help the team spot automated submissions. Capped to
-- the column width by the API.

ALTER TABLE platform.demo_requests
  ADD COLUMN IF NOT EXISTS user_agent varchar(512);

INSERT INTO schema_migrations (version)
VALUES ('0067_demo_request_user_agent')
ON CONFLICT (version) DO NOTHING;
