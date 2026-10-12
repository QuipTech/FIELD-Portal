#!/usr/bin/env bash
# One-time setup for a fresh Amazon Linux 2023 instance (paste as EC2 user
# data, or run with sudo over Session Manager). AWS CLI v2 and the SSM agent
# already ship with AL2023; this adds Docker + Compose and the app folder.
set -euo pipefail

APP_ROOT=/opt/field-portal

dnf install -y docker
systemctl enable --now docker

plugin_dir=/usr/local/lib/docker/cli-plugins
mkdir -p "$plugin_dir"
curl -fsSL \
  "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o "$plugin_dir/docker-compose"
chmod +x "$plugin_dir/docker-compose"

mkdir -p "$APP_ROOT/releases"
chmod 700 "$APP_ROOT"

docker compose version
echo "Host ready. Deploys land in $APP_ROOT/releases/<release id>."
