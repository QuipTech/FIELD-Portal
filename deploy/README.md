# Deploy — FIELD Portal on Amazon EC2

## Purpose

Everything needed to ship the portal (Next.js) and its API (NestJS) to
Amazon EC2, with one host per environment. GitHub Actions
(`.github/workflows/deployPortal.yml`) builds Docker images, pushes them to
ECR and tells the host to roll out over **SSM Run Command**, so no SSH port
or SSH key is needed. On the host, Docker Compose runs `portal`, `api` and
**Caddy**, which terminates HTTPS and issues Let's Encrypt certificates
automatically.

| Environment | Git branch | Portal URL                | API URL                       |
| ----------- | ---------- | ------------------------- | ----------------------------- |
| staging     | `dev`      | `https://staging.<domain>` | `https://staging-api.<domain>` |
| production  | `main`     | `https://app.<domain>`     | `https://api.<domain>`         |

The API gets its own hostname because Socket.IO reads its namespace
(`/support-cases`, `/notifications`) from the URL path, so the API can't sit
under a path like `/api`. Hostnames are GitHub environment variables, so
changing a domain never needs a code change.

## Folder structure

```
deploy/
├── docker/
│   ├── portal.Dockerfile (+ .dockerignore)  ← Next.js standalone image, context = repo root
│   └── api.Dockerfile (+ .dockerignore)     ← NestJS + psql for migrations, context = backend/
├── compose/docker-compose.yml   ← portal, api, caddy, and a one-shot `migrate` service
├── caddy/Caddyfile              ← HTTPS + reverse proxy for both hostnames
├── scripts/
│   ├── bootstrapEc2Host.sh      ← one-time host setup (Docker + Compose)
│   ├── resolveDeployConfig.sh   ← runs in CI: branch → environment + its variables
│   ├── triggerRemoteDeploy.sh   ← runs in CI: sends the SSM command, waits for it
│   └── deployRelease.sh         ← runs on the host: secrets → pull → migrate → up
└── iam/                         ← policy templates (replace the <PLACEHOLDERS>)
```

## How a deploy runs

1. A push to `dev` (staging) or `main` (production) starts the workflow. To
   redeploy without a new commit, use **Actions → Deploy Portal → Run
   workflow** and pick the branch.
2. **verify** runs the backend's unit tests and build.
3. **buildImages** builds `field-portal-api` and `field-portal-web`, tagged
   `<environment>-<commit sha>`. The portal is built per environment because
   `NEXT_PUBLIC_*` values are baked in at build time.
4. **deploy** uploads `deploy/` to S3 and sends an SSM command to the
   host, which runs `deployRelease.sh`. That script:
   - reads `/field-portal/<env>/api-env` and `/field-portal/<env>/migrations-env`
     from Parameter Store into `/opt/field-portal/*.env` (mode 600)
   - pulls the images, then runs `backend/db/applyMigrations.sh` (all
     migrations are safe to re-run)
   - restarts the containers and waits until their health checks pass
   - if anything fails, prints container logs into the Actions output
5. A smoke test calls both public URLs.

**Rollback:** re-run an earlier successful run (**Actions → that run →
Re-run all jobs**), or revert the commit and push. The images are
still in ECR. Migrations only add things, so older code keeps working with
the newer schema.

**Downtime:** a rollout recreates the containers on a single host, so expect
a few seconds of downtime. Zero-downtime deploys would need two hosts
behind an ALB.

## One-time AWS setup (repeat per environment unless noted)

Region: `ap-southeast-2` (the RDS instance's region).

1. **ECR** (once): create the repositories `field-portal-web` and
   `field-portal-api`. Add a lifecycle rule that keeps the last 30 images.
2. **S3 deploy bucket** (once): create a private bucket, for example
   `quiptech-field-deploy`. Add a lifecycle rule that expires `releases/`
   after 30 days.
3. **GitHub OIDC** (once): add the identity provider
   `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
   Create the role `field-portal-github-deploy` with
   `iam/githubDeployTrustPolicy.json` as its trust policy and
   `iam/githubDeployPolicy.json` as its permissions.
4. **Instance role**: create `field-portal-<env>-ec2` with the AWS managed
   policy `AmazonSSMManagedInstanceCore` and `iam/ec2InstancePolicy.json`,
   with `<ENVIRONMENT>` set to `staging` or `production`. The API then
   uses this role for S3, Bedrock, SES, SNS and Cognito, so leave
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` **out** of the env file.
5. **EC2 instance**: Amazon Linux 2023, `t3.medium` or larger (staging can
   use `t3.small`), 30 GB gp3, the instance role from step 4, and the tag
   `Project=field-portal`. Paste `scripts/bootstrapEc2Host.sh` as user
   data. Keep IMDSv2 hop limit = 2 (the AL2023 default) so containers can
   reach the instance role.
6. **Elastic IP**: allocate one and associate it with the instance.
7. **Security groups**:
   - Instance: allow inbound 80 and 443 from `0.0.0.0/0` (80 is needed for
     certificate issuance and redirects). Port 22 is not needed.
   - RDS: allow 5432 from the instance's security group.
8. **DNS**: create A records pointing at the Elastic IP, for
   `app.<domain>` + `api.<domain>` (production) or `staging.<domain>` +
   `staging-api.<domain>` (staging). Create them **before** the first deploy,
   otherwise Caddy can't get certificates.
9. **Secrets** in SSM Parameter Store (`SecureString`, **Advanced** tier if
   the content is over 4 KB):
   - `/field-portal/<env>/api-env`: the backend env file, in the format of
     `backend/.env.example`. Set `PORTAL_ORIGIN=https://app.<domain>` (or the
     staging URL), point `DATABASE_URL` at `field_app` and
     `SERVICE_DATABASE_URL` at `field_service` on the environment's
     database (`quiptech_staging` / `quiptech_prod`), with
     `sslmode=verify-full`. `NODE_ENV`, `PORT` and `TRUST_PROXY_HOPS` are
     set by compose, so leave them out.
   - `/field-portal/<env>/migrations-env`: a single line,
     `MIGRATION_DATABASE_URL=postgresql://<admin user>:<pw>@<rds host>:5432/<db>?sslmode=verify-full`
   - Before the first production deploy, rotate the placeholder passwords of
     `field_app` and `field_service` (see `backend/README.md`).
10. **Cognito app client**: add the callback URL
    `https://<portal host>/auth/callback` and the sign-out URL
    `https://<portal host>/login` for each environment.
11. **SES**: production needs SES out of sandbox mode and a verified
    `SES_FROM_EMAIL` identity.

## GitHub setup

All settings are **repository variables**: **Settings → Secrets and
variables → Actions → Variables** tab (not the Secrets tab, since the
workflow reads `vars.*`, and none of these values are secret). The branch
decides the environment, and
`scripts/resolveDeployConfig.sh` picks `STAGING_<NAME>` / `PRODUCTION_<NAME>`
first, then a shared `<NAME>`. The server and domains **must** be
environment-prefixed. They have no shared fallback, so production can never
deploy onto the staging server.

| Variable                           | Scope    | Example                                                    |
| ---------------------------------- | -------- | ---------------------------------------------------------- |
| `AWS_REGION`                       | shared   | `ap-southeast-2`                                           |
| `AWS_DEPLOY_ROLE_ARN`              | shared   | `arn:aws:iam::<ACCOUNT_ID>:role/field-portal-github-deploy` |
| `DEPLOY_BUCKET`                    | shared   | `quiptech-field-deploy-<ACCOUNT_ID>`                       |
| `ACME_EMAIL`                       | shared   | the address Let's Encrypt sends expiry notices to          |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | shared*  | the user pool ID                                           |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID`    | shared*  | the app client ID                                          |
| `NEXT_PUBLIC_COGNITO_DOMAIN`       | shared*  | the hosted UI domain                                       |
| `STAGING_EC2_INSTANCE_ID`          | staging  | `i-0123456789abcdef0`                                      |
| `STAGING_PORTAL_DOMAIN`            | staging  | `staging.<domain>`                                         |
| `STAGING_API_DOMAIN`               | staging  | `staging-api.<domain>`                                     |
| `PRODUCTION_EC2_INSTANCE_ID`       | prod     | `i-0fedcba9876543210`                                      |
| `PRODUCTION_PORTAL_DOMAIN`         | prod     | `app.<domain>`                                             |
| `PRODUCTION_API_DOMAIN`            | prod     | `api.<domain>`                                             |

\* Any shared variable can be overridden for one environment by adding the
prefixed name, e.g. `PRODUCTION_NEXT_PUBLIC_COGNITO_CLIENT_ID`.

The AWS deploy role only trusts pushes and manual runs on `dev` and `main`
(`iam/githubDeployTrustPolicy.json`). There is no approval step before
production deploys, so whoever can push or merge to `main` deploys
production. Protect `main` with a pull-request rule if the GitHub plan allows
it.

## Key conventions

- Runtime secrets live **only** in Parameter Store. They are never in the
  repository, never in images, and never in GitHub.
- Images are immutable, one tag per environment and commit. The host never
  builds anything.
- The `migrate` service is the only place the migration/admin database user
  is used. The running API only ever has `field_app` / `field_service`.
- Change hostnames through GitHub environment variables, not through code.

## Running on the host (debugging)

```bash
aws ssm start-session --target <instance-id>
sudo -i
cd /opt/field-portal
ls -t releases | head -1   # the release currently running
docker compose -p field-portal ps
docker compose -p field-portal logs -f api
```

## Environment variables required

From GitHub repository variables (see the table above): `AWS_REGION`,
`AWS_DEPLOY_ROLE_ARN`, `DEPLOY_BUCKET`, `ACME_EMAIL`,
`NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`,
`NEXT_PUBLIC_COGNITO_DOMAIN`, and per environment `<ENV>_EC2_INSTANCE_ID`,
`<ENV>_PORTAL_DOMAIN`, `<ENV>_API_DOMAIN`.

On the host (Parameter Store): the backend variables in
`backend/.env.example`, plus `MIGRATION_DATABASE_URL`.
