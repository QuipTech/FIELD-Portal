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

# Assigned on their own lines so a failed query (e.g. no connection) stops
# the script under set -e — inside `[ "$(…)" = … ]` it wouldn't, and every
# migration from 0001 would be treated as unapplied.
has_migrations_table="$(run_query "SELECT to_regclass('schema_migrations') IS NOT NULL")"
applied_versions=""
if [ "$has_migrations_table" = "t" ]; then
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
