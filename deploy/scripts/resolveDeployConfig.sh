#!/usr/bin/env bash
# Runs in GitHub Actions. Maps the branch to an environment (staging-dev →
# staging, main → production) and picks that environment's settings from the
# repository variables: <ENV>_<NAME> (e.g. STAGING_EC2_INSTANCE_ID) wins,
# otherwise the shared <NAME> is used. Fails fast if any setting is missing.
# Host, domains and Cognito have no shared fallback, so production can
# never inherit staging's server or user pool by accident.
set -euo pipefail

: "${BRANCH:?}" "${VARS_JSON:?}" "${GITHUB_OUTPUT:?}"

SCOPED_SETTINGS=(EC2_INSTANCE_ID PORTAL_DOMAIN API_DOMAIN
  NEXT_PUBLIC_COGNITO_USER_POOL_ID NEXT_PUBLIC_COGNITO_CLIENT_ID
  NEXT_PUBLIC_COGNITO_DOMAIN)
SHAREABLE_SETTINGS=(AWS_REGION AWS_DEPLOY_ROLE_ARN DEPLOY_BUCKET ACME_EMAIL)

case "$BRANCH" in
  main) environment=production ;;
  staging-dev) environment=staging ;;
  *)
    echo "::error::Only staging-dev (staging) and main (production) deploy; got '$BRANCH'"
    exit 1
    ;;
esac
prefix=$(tr '[:lower:]' '[:upper:]' <<< "$environment")
echo "ENVIRONMENT=$environment" >> "$GITHUB_OUTPUT"

missing=()
# $1: setting name, $2: "scoped" (only <ENV>_<NAME>) or "shareable".
output_setting() {
  local shared_key="$1"
  [[ "$2" == "scoped" ]] && shared_key="__none__"
  local value
  value=$(jq -r --arg scoped "${prefix}_$1" --arg shared "$shared_key" \
    '.[$scoped] // .[$shared] // ""' <<< "$VARS_JSON")
  if [[ -z "$value" ]]; then
    missing+=("${prefix}_$1")
  else
    echo "$1=$value" >> "$GITHUB_OUTPUT"
  fi
}

for name in "${SCOPED_SETTINGS[@]}"; do output_setting "$name" scoped; done
for name in "${SHAREABLE_SETTINGS[@]}"; do output_setting "$name" shareable; done

if ((${#missing[@]})); then
  printf '::error::Missing repository variable: %s\n' "${missing[@]}"
  exit 1
fi

# Production users must never land in the staging user pool.
if [[ "$environment" == "production" ]]; then
  staging_pool=$(jq -r '.STAGING_NEXT_PUBLIC_COGNITO_USER_POOL_ID // ""' <<< "$VARS_JSON")
  production_pool=$(jq -r '.PRODUCTION_NEXT_PUBLIC_COGNITO_USER_POOL_ID' <<< "$VARS_JSON")
  if [[ "$production_pool" == "$staging_pool" ]]; then
    echo "::error::PRODUCTION_NEXT_PUBLIC_COGNITO_USER_POOL_ID is the staging user pool"
    exit 1
  fi
fi
echo "Deploying $BRANCH to $environment" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
