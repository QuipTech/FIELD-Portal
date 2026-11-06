-- Section 1n: push notifications through Amazon SNS (APNs for iOS, FCM for
-- Android). The app registers its raw token with POST /me/devices; the API
-- creates the SNS platform endpoint and publishes to it. The app never
-- talks to SNS.
--   * device_registrations remember which app build sent the token
--     (bundle ID and APNs environment pick the SNS platform application),
--     the SNS endpoint ARN, and when SNS disabled the endpoint.
--   * A token belongs to one person at a time: on a shared phone it moves
--     to whoever signed in last (register_push_device()).
--   * notifications.pushed_at: each notification is pushed once, by
--     whichever API container claims it first (claim_notification_push()).

ALTER TABLE device_registrations
  ADD COLUMN IF NOT EXISTS bundle_id varchar,
  ADD COLUMN IF NOT EXISTS apns_environment varchar
    CHECK (apns_environment IN ('sandbox', 'production')),
  ADD COLUMN IF NOT EXISTS endpoint_arn varchar,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- One row per token (it may have been registered by several people on a
-- shared phone): keep the newest.
DELETE FROM device_registrations d
USING device_registrations newer
WHERE newer.push_token = d.push_token
  AND (newer.last_seen_at, newer.id) > (d.last_seen_at, d.id);

DROP INDEX IF EXISTS uq_device_registrations_user_token;
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_registrations_token
  ON device_registrations (push_token);
CREATE INDEX IF NOT EXISTS idx_device_registrations_user
  ON device_registrations (user_id);

-- Registers the caller's token: a row another person held for this token
-- (any organisation) is handed over, so a shared phone only ever notifies
-- whoever signed in last. The SNS endpoint is kept, since it belongs to
-- the token, and re-pointed at the new user by the API. Runs as the
-- caller: app.tenant_id and app.user_id must be set.
CREATE OR REPLACE FUNCTION register_push_device(
  p_device_type       varchar,
  p_push_token        varchar,
  p_app_version       varchar,
  p_bundle_id         varchar,
  p_apns_environment  varchar
)
RETURNS TABLE (
  id uuid, device_type varchar, push_token varchar, app_version varchar,
  bundle_id varchar, apns_environment varchar, endpoint_arn varchar,
  disabled_at timestamptz, last_seen_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_tenant uuid := current_tenant_id();
  v_user uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
BEGIN
  IF v_tenant IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'register_push_device needs the signed-in user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  INSERT INTO device_registrations AS d
    (tenant_id, user_id, device_type, push_token, app_version, bundle_id, apns_environment)
  VALUES (v_tenant, v_user, p_device_type, p_push_token, p_app_version, p_bundle_id, p_apns_environment)
  ON CONFLICT (push_token) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id,
        device_type = EXCLUDED.device_type, app_version = EXCLUDED.app_version,
        bundle_id = EXCLUDED.bundle_id, apns_environment = EXCLUDED.apns_environment,
        -- A different app build means a different SNS platform application.
        endpoint_arn = CASE
          WHEN d.bundle_id IS NOT DISTINCT FROM EXCLUDED.bundle_id
           AND d.apns_environment IS NOT DISTINCT FROM EXCLUDED.apns_environment
          THEN d.endpoint_arn END,
        last_seen_at = now(), updated_at = now()
  RETURNING d.id, d.device_type, d.push_token, d.app_version, d.bundle_id,
            d.apns_environment, d.endpoint_arn, d.disabled_at, d.last_seen_at, d.created_at;
END;
$$;

REVOKE ALL ON FUNCTION register_push_device(varchar, varchar, varchar, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_push_device(varchar, varchar, varchar, varchar, varchar) TO field_app;

-- ── Sending ────────────────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Claims a new notification for pushing: returns it once (to the first
-- caller) with the person's unread count for the badge, and whether their
-- preferences allow a push of this kind. A notification older than an
-- hour is never pushed late (e.g. after an outage).
CREATE OR REPLACE FUNCTION claim_notification_push(p_notification_id uuid)
RETURNS TABLE (
  tenant_id uuid, user_id uuid, kind varchar, title text, body text, link text,
  unread_count bigint, push_allowed boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH claimed AS (
    UPDATE notifications n SET pushed_at = now()
    WHERE n.id = p_notification_id AND n.pushed_at IS NULL
      AND n.created_at > now() - interval '1 hour'
    RETURNING n.*
  )
  SELECT c.tenant_id, c.user_id, c.kind, c.title, c.body, c.link,
         (SELECT count(*) FROM notifications u
          WHERE u.user_id = c.user_id AND u.read_at IS NULL) AS unread_count,
         coalesce(p.push_enabled AND NOT (c.kind = ANY (p.muted_kinds)), true) AS push_allowed
  FROM claimed c
  LEFT JOIN user_notification_preferences p ON p.user_id = c.user_id;
$$;

REVOKE ALL ON FUNCTION claim_notification_push(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_notification_push(uuid) TO field_app;

INSERT INTO schema_migrations (version)
VALUES ('0112_push_endpoints')
ON CONFLICT (version) DO NOTHING;
