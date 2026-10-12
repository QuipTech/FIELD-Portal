#!/usr/bin/env bash
# Runs ON the EC2 host (sent over SSM by triggerRemoteDeploy.sh). Rolls out
# one release: fetches runtime secrets from SSM Parameter Store, pulls the
# images, applies migrations, then swaps containers and waits for health.
set -euo pipefail

: "${FIELD_ENVIRONMENT:?}" "${AWS_REGION:?}" "${PORTAL_IMAGE:?}" "${API_IMAGE:?}"
: "${PORTAL_DOMAIN:?}" "${API_DOMAIN:?}" "${ACME_EMAIL:?}"

APP_ROOT=/opt/field-portal
RELEASES_TO_KEEP=5
release_dir="$(cd "$(dirname "$0")/../.." && pwd)"
compose_file="$release_dir/deploy/compose/docker-compose.yml"

log() {
  echo "[$(date -u +%H:%M:%S)] $*"
}

run_compose() {
  docker compose --env-file "$APP_ROOT/release.env" -f "$compose_file" "$@"
}

write_release_env() {
  cat > "$APP_ROOT/release.env" <<RELEASE_ENV
APP_ROOT=$APP_ROOT
FIELD_ENVIRONMENT=$FIELD_ENVIRONMENT
PORTAL_IMAGE=$PORTAL_IMAGE
API_IMAGE=$API_IMAGE
PORTAL_DOMAIN=$PORTAL_DOMAIN
API_DOMAIN=$API_DOMAIN
ACME_EMAIL=$ACME_EMAIL
RELEASE_ENV
}

# $1: parameter name under /field-portal/<environment>/, $2: target file.
fetch_secret_env_file() {
  local parameter="/field-portal/$FIELD_ENVIRONMENT/$1"
  (
    umask 077
    aws ssm get-parameter --region "$AWS_REGION" --with-decryption \
      --name "$parameter" --query Parameter.Value --output text > "$2.tmp"
  )
  mv "$2.tmp" "$2"
}

login_to_ecr() {
  aws ecr get-login-password --region "$AWS_REGION" |
    docker login --username AWS --password-stdin "${API_IMAGE%%/*}" > /dev/null
}

print_failure_diagnostics() {
  log "Deploy failed — container state and recent logs:"
  run_compose ps --all || true
  run_compose logs --tail 80 || true
}

prune_old_releases() {
  find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -rn | tail -n +$((RELEASES_TO_KEEP + 1)) | cut -d' ' -f2- |
    xargs -r rm -rf
  docker image prune --all --force --filter "until=168h" > /dev/null
}

log "Deploying $FIELD_ENVIRONMENT from $release_dir"
write_release_env
fetch_secret_env_file api-env "$APP_ROOT/api.env"
fetch_secret_env_file migrations-env "$APP_ROOT/migrations.env"
login_to_ecr

trap print_failure_diagnostics ERR
log "Pulling images"
run_compose --profile tools pull --quiet
log "Applying migrations"
run_compose run --rm migrate
log "Starting containers"
run_compose up --detach --remove-orphans --wait --wait-timeout 240
trap - ERR

prune_old_releases
run_compose ps
log "Deployed $FIELD_ENVIRONMENT: https://$PORTAL_DOMAIN"
