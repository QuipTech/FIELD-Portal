# Production readiness — status

**Last updated:** 7 October 2026
**Status:** ⏸ **Paused.** Production infrastructure is built, but go-live is
on hold until (1) the client signs off on the production decisions below,
and (2) one full round of testing passes on **staging**.

| Environment | Portal                                 | API                                        | Deploys from  |
| ----------- | -------------------------------------- | ------------------------------------------ | ------------- |
| Staging     | https://staging.quiptechfield.com.au   | https://staging-api.quiptechfield.com.au   | `staging-dev` |
| Production  | https://app.quiptechfield.com.au       | https://app-api.quiptechfield.com.au       | `main`        |

Production is **not deployed yet**. Nothing runs on the production server
until `staging-dev` is merged into `main`. For how deploys work, see
[`README.md`](README.md). For the generic go-live procedure, see
[`productionLaunch.md`](productionLaunch.md).

---

## 1. Done

### AWS (account `357941178657`, region `ap-southeast-2`)

| Resource                    | Value                                                         | Notes                                                                 |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Cognito user pool           | `ap-southeast-2_wKANhY7Gj` ("field production")               | Separate from staging. Deletion protection on.                        |
| Cognito app client          | `1jdchvunhr03hl5pll13od20k0` ("FIELD Portal production")      | No secret. Allowed URLs: `app.quiptechfield.com.au` only.             |
| Cognito sign-in domain      | `quiptech-field.auth.ap-southeast-2.amazoncognito.com`        | Managed login v2.                                                     |
| Google sign-in              | Configured on the production pool                             | Tested end to end ✅                                                  |
| Apple sign-in               | Configured on the production pool                             | Not tested yet (see 2.1).                                             |
| EC2 instance                | `i-0c61212e75f6edf99` (`field-portal-production`, t3.medium), **stopped** | Amazon Linux 2023, 30 GB encrypted disk, termination protection on.   |
| Elastic IP                  | `54.252.72.82`                                                | Attached to the production instance.                                  |
| Security group              | `sg-05b0d546b3697fa2c`                                        | Inbound 80/443 only. No SSH; access is through SSM.                   |
| Database access             | RDS security group allows 5432 from the production SG         | Same RDS instance as staging, separate database `quiptech_prod`.      |
| IAM role                    | `field-portal-production-ec2`                                 | Scoped to production secrets, the production pool and the production bucket. |
| File storage bucket         | `quiptech-field-portal-storage-prod`                          | Private, encrypted, versioned. CORS: `app.quiptechfield.com.au`.      |
| Secrets                     | `/field-portal/production/api-env`, `/field-portal/production/migrations-env` | SecureString in SSM Parameter Store. New JWT secrets were generated. |

### Outside AWS

| Item                          | Status                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| DNS (Crazy Domains)           | ✅ `app` and `app-api` A records → `54.252.72.82`                             |
| Google OAuth app              | ✅ Production redirect URI added, consent screen **In production**             |
| Google domain ownership       | ✅ TXT record live on `quiptechfield.com.au`. Confirm Search Console shows it as verified |
| GitHub repository variables   | ✅ All `PRODUCTION_*` and `STAGING_NEXT_PUBLIC_COGNITO_*` variables added      |
| Production database           | ✅ `quiptech_prod` exists, `field_app` / `field_service` roles can connect, no migrations run yet |

### Code (branch `dev`, **not committed yet**)

- `deploy/scripts/resolveDeployConfig.sh`: Cognito settings are now set
  per environment, with no shared fallback. A production deploy fails if it
  points at the staging user pool.
- Docs: `deploy/README.md`, `deploy/productionLaunch.md`, the root
  `README.md`, and this file.

---

## 2. Still required

### 2.1 Before production (our side, no client decision needed)

| #   | Task                                                                                         | Owner |
| --- | -------------------------------------------------------------------------------------------- | ----- |
| 1   | Commit the code changes and merge `dev` → `staging-dev`, which deploys staging                | Dev   |
| 2   | **Full test round on staging** ([`stagingTestChecklist.md`](stagingTestChecklist.md))                                       | Dev / QA |
| 3   | Apple Developer: add the production domain and return URL to Services ID `com.quiptech.field.services`, then test Apple sign-in | Dev |
| 4   | Confirm `quiptech_prod` has **0 tables** before the first deploy (the first deploy runs all 68 migrations) | Dev |
| 5   | After staging passes, delete the old unprefixed `NEXT_PUBLIC_COGNITO_*` GitHub variables      | Dev   |
| 6   | Google Auth Platform → Branding → **Verify branding**, so the Google sign-in screen shows "FIELD" instead of the Cognito address (2–5 business days) | Dev |
| 7   | Delete the Google test user from the production pool (`Google_108434626990042435509`)         | Dev   |

### 2.2 Needs client decision or approval (paused)

| #   | Item                                    | Why it matters                                                                                                     |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A   | **SES production access** (Amazon email) | SES is in sandbox mode, so it only emails verified addresses. Until it's approved, real customers get **no** verification codes, password resets, invitations, alerts or reports. AWS reviews the request in about 24 h. |
| B   | **Cognito email through SES**           | The pool currently uses Cognito's built-in sender (about 50 emails a day, generic sender). After A, switch to `no-reply@quiptechfield.com.au`. |
| C   | **Turn on notifications**               | `NOTIFICATIONS_ENABLED=false` in production for now. Turn it on after A.                                      |
| D   | **SMS (SNS)**                           | The account is likely in the SMS sandbox too. Needed only if P1 SMS alerts are wanted in production.               |
| E   | **Stripe live keys**                    | Billing is disabled in production (no Stripe keys). Add live keys and a webhook if billing is in scope.            |
| F   | **Demo request inbox**                  | Demo requests go to `uneebmalik99@gmail.com`. Confirm the client's sales inbox.                                    |
| G   | **Running cost while paused**           | The production server was **stopped on 7 Oct 2026** to save cost. While stopped it costs about US$7/month (Elastic IP + disk). Start it before go-live; see section 5. |
| H   | **Database isolation**                  | Staging and production share one RDS instance (and the `field_app` / `field_service` passwords). This is fine for launch, but separate instances or roles would be safer. |
| I   | **RDS public access**                   | The database is publicly reachable (limited to 3 allowed IPs). We recommend turning public access off before launch. |

---

## 3. Issues found during setup

| Issue                                                                                          | Status |
| ---------------------------------------------------------------------------------------------- | ------ |
| Staging portal was built against the **dev** Cognito pool, while the staging API checks the **staging** pool, so staging sign-in likely failed with 401 | Fixed by the new per-environment variables on the next staging deploy |
| `backend/.env.production` used the `postgres` master user as the API's `DATABASE_URL`, which bypasses tenant isolation (RLS) | Production API now uses `field_app`; `postgres` is used for migrations only |
| `backend/.env.production` had **empty** `JWT_SECRET` / `JWT_REFRESH_SECRET`                    | New random secrets generated in Parameter Store |
| Staging `DEMO_REQUEST_NOTIFY_TO` has a typo (`gmail.ocm`)                                      | Open: fix in `/field-portal/staging/api-env` |

---

## 4. Staging test checklist (must pass before production)

The full checklist is in [`stagingTestChecklist.md`](stagingTestChecklist.md).
All 🔴 critical sections must pass and be signed off before go-live.

---

## 5. Go-live steps (after sign-off)

1. Complete 2.1 and the approved items in 2.2.
2. If the server was stopped:
   `aws ec2 start-instances --instance-ids i-0c61212e75f6edf99 --region ap-southeast-2`
   The Elastic IP stays attached.
3. Open a pull request `staging-dev` → `main` on GitHub and merge it. The
   production deploy starts automatically (about 10 minutes).
4. Run [`stagingTestChecklist.md`](stagingTestChecklist.md) (critical rows) against `https://app.quiptechfield.com.au`,
   and confirm that new users appear in the **production** Cognito pool only.

**Pausing to save cost:**
`aws ec2 stop-instances --instance-ids i-0c61212e75f6edf99 --region ap-southeast-2`.
This stops the server charges. The Elastic IP (about US$4/month) and the disk
(about US$3/month) still cost while stopped.

---

## 6. Monthly cost estimate (production only)

| Item                       | Approx. USD / month |
| -------------------------- | ------------------- |
| EC2 t3.medium              | 30                  |
| EBS 30 GB gp3              | 3                   |
| Elastic IP                 | 4                   |
| S3, SSM, Cognito (< 10k MAU) | ~1                |
| **Total (excl. shared RDS, Bedrock, SES usage)** | **~38** |
