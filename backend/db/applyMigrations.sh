#!/bin/sh
# Applies every migration in order. Each file is idempotent, so the full
# set is re-run on every deploy rather than tracking which ones ran.
# Needs a role that owns the schema (not field_app), hence its own URL.
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is not set}"
# libpq doesn't trust Amazon's RDS CA by default (sslmode=verify-full).
export PGSSLROOTCERT="${PGSSLROOTCERT:-/app/certs/rdsGlobalBundle.pem}"

migrations_dir="$(dirname "$0")/migrations"
for migration in "$migrations_dir"/*.sql; do
  echo "Applying $(basename "$migration")"
  psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$migration"
done
echo "Migrations applied."
