#!/bin/sh
# Applies, in order, every migration not yet recorded in schema_migrations
# (each file inserts its own version row as its last statement). Re-running
# already-applied files is not safe: a later migration may drop and recreate
# a function with a different signature that the earlier file would revert.
# Needs a role that owns the schema (not field_app), hence its own URL.
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is not set}"
# libpq doesn't trust Amazon's RDS CA by default (sslmode=verify-full).
export PGSSLROOTCERT="${PGSSLROOTCERT:-/app/certs/rdsGlobalBundle.pem}"

run_query() {
  psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c "$1"
}

applied_versions=""
if [ "$(run_query "SELECT to_regclass('schema_migrations') IS NOT NULL")" = "t" ]; then
  applied_versions="$(run_query "SELECT version FROM schema_migrations")"
fi

migrations_dir="$(dirname "$0")/migrations"
for migration in "$migrations_dir"/*.sql; do
  version="$(basename "$migration" .sql)"
  if printf '%s\n' "$applied_versions" | grep -qxF "$version"; then
    continue
  fi
  echo "Applying $version"
  psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$migration"
done
echo "Migrations applied."
