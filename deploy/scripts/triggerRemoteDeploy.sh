#!/usr/bin/env bash
# Runs in GitHub Actions. Asks the environment's EC2 host (via SSM Run
# Command — no SSH port needed) to download this release's deploy bundle
# from S3 and run deployRelease.sh, then waits and relays its output.
set -euo pipefail

required_vars=(EC2_INSTANCE_ID AWS_REGION BUNDLE_S3_URI RELEASE_ID
  FIELD_ENVIRONMENT PORTAL_IMAGE API_IMAGE PORTAL_DOMAIN API_DOMAIN ACME_EMAIL)
for name in "${required_vars[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "::error::$name is not set" >&2; exit 1; }
done

POLL_INTERVAL_SECONDS=10
MAX_POLLS=120
release_dir="/opt/field-portal/releases/$RELEASE_ID"
bundle_file="/tmp/field-portal-$RELEASE_ID.tgz"

build_remote_script() {
  printf 'set -eu\n'
  printf 'rm -rf %q && mkdir -p %q\n' "$release_dir" "$release_dir"
  printf 'aws s3 cp --quiet %q %q\n' "$BUNDLE_S3_URI" "$bundle_file"
  printf 'tar -xzf %q -C %q && rm -f %q\n' "$bundle_file" "$release_dir" "$bundle_file"
  printf 'export FIELD_ENVIRONMENT=%q AWS_REGION=%q\n' "$FIELD_ENVIRONMENT" "$AWS_REGION"
  printf 'export PORTAL_IMAGE=%q API_IMAGE=%q\n' "$PORTAL_IMAGE" "$API_IMAGE"
  printf 'export PORTAL_DOMAIN=%q API_DOMAIN=%q ACME_EMAIL=%q\n' \
    "$PORTAL_DOMAIN" "$API_DOMAIN" "$ACME_EMAIL"
  printf 'bash %q/deploy/scripts/deployRelease.sh\n' "$release_dir"
}

send_deploy_command() {
  local parameters
  parameters=$(jq -n --arg script "$(build_remote_script)" \
    '{commands: [$script], executionTimeout: ["1200"]}')
  aws ssm send-command \
    --instance-ids "$EC2_INSTANCE_ID" \
    --document-name AWS-RunShellScript \
    --comment "FIELD portal $FIELD_ENVIRONMENT $RELEASE_ID" \
    --parameters "$parameters" \
    --query Command.CommandId --output text
}

# Prints the final status; InvocationDoesNotExist right after sending just
# means the agent hasn't picked the command up yet.
wait_for_command() {
  local status="Pending"
  for _ in $(seq 1 "$MAX_POLLS"); do
    status=$(aws ssm get-command-invocation --command-id "$1" \
      --instance-id "$EC2_INSTANCE_ID" --query Status --output text 2> /dev/null ||
      echo Pending)
    case "$status" in
      Pending | InProgress | Delayed) sleep "$POLL_INTERVAL_SECONDS" ;;
      *) break ;;
    esac
  done
  echo "$status"
}

print_command_output() {
  aws ssm get-command-invocation --command-id "$1" --instance-id "$EC2_INSTANCE_ID" \
    --query '[StandardOutputContent, StandardErrorContent]' --output text
}

command_id=$(send_deploy_command)
echo "SSM command $command_id sent to $EC2_INSTANCE_ID"
final_status=$(wait_for_command "$command_id")
print_command_output "$command_id"

if [[ "$final_status" != "Success" ]]; then
  echo "::error::Deploy to $FIELD_ENVIRONMENT ended with status $final_status"
  exit 1
fi
