-- Section 1l: profile fields for the mobile app.
--   * users.site: where the person usually works (free text, like
--     machines.site; the app offers the organisation's machine sites)
--   * users.language: the app's language, a BCP 47 tag such as "en" or
--     "en-AU"; existing users get "en"

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS site varchar,
  ADD COLUMN IF NOT EXISTS language varchar NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_language_tag') THEN
    ALTER TABLE users ADD CONSTRAINT users_language_tag
      CHECK (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$');
  END IF;
END
$$;

INSERT INTO schema_migrations (version)
VALUES ('0105_user_profile_preferences')
ON CONFLICT (version) DO NOTHING;
