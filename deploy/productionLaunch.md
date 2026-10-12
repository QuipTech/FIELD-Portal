# Production go-live — step by step

Once these steps are done, every merge into `main` deploys production
automatically (`.github/workflows/deployPortal.yml`), and production signs
users in against its **own** Cognito user pool. Staging keeps its pool.
Follow the steps in order. Region everywhere: `ap-southeast-2`.

Throughout, `<domain>` is the production domain, so the portal is
`https://app.<domain>` and the API is `https://api.<domain>`.

## 1. Production Cognito user pool

The portal and API depend on these exact settings, so match them:

1. **Cognito → Create user pool**, type *Traditional web application*.
   - Sign-in identifier: **Email**. Self-registration: **on**.
   - No extra required attributes (as on staging). The portal and invites
     always send `given_name` / `family_name`. Apple doesn't always share a
     name, and if the name were required, those Apple sign-ups would fail.
   - Email verification by **code**. For production, send email through
     **SES** (the verified `SES_FROM_EMAIL` identity), because Cognito's
     built-in sender is capped at a few emails a day.
   - Copy the password policy and MFA settings from the staging pool.
2. **App client** (the one the wizard created, or a new public client):
   - **No client secret.**
   - Auth flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`.
   - Attribute read/write: `email`, `given_name`, `family_name`, `picture`,
     `name`.
3. **Domain**: under *Branding → Domain*, create a Cognito domain such as
   `field-prod.auth.ap-southeast-2.amazoncognito.com`, or a custom one like
   `auth.<domain>`.
4. **Google identity provider** (*Authentication → Social and external
   providers → Add → Google*):
   - In Google Cloud Console, either reuse the OAuth client or create a
     production one. Add the authorised redirect URI
     `https://<cognito domain>/oauth2/idpresponse` and the authorised
     JavaScript origin `https://<cognito domain>`.
   - Scopes: `openid email profile`. Map the attributes `email`,
     `email_verified`, `given_name`, `family_name`, `name` and `picture`.
   - The provider name must stay **`Google`**, because the API matches on it.
5. **Apple identity provider** (*Add → Sign in with Apple*):
   - In the Apple Developer account, open the Services ID used for web sign-in
     and add the domain `<cognito domain>` and the return URL
     `https://<cognito domain>/oauth2/idpresponse`. Apple accepts
     several return URLs, so staging keeps working.
   - Fill in the Services ID, Team ID, Key ID and the `.p8` private key
     (the same key as staging). Cognito never returns the key, so it can't
     be copied from the staging pool. Paste it from the `.p8` file, and
     never commit it.
   - Scopes: `email name`. Map `email`, `email_verified`, `firstName` →
     `given_name` and `lastName` → `family_name`.
   - The provider name is **`SignInWithApple`** (Cognito's fixed name,
     which the API matches on).
6. **Managed login / hosted UI** on the app client:
   - Identity providers: *Cognito user pool*, *Google*, *Sign in with Apple*.
   - Callback URL: `https://app.<domain>/auth/callback`.
   - Sign-out URL: `https://app.<domain>/login`.
   - Grant type: *Authorization code*. Scopes: `openid`, `email`, `profile`.
7. Write down the **user pool ID**, **app client ID** and **domain**. Steps
   2–4 use them.

## 2. Production host and AWS resources

Follow [`README.md`](README.md) → *One-time AWS setup*, steps 4–9 and 11,
with `<env>` = `production`:

1. Instance role `field-portal-production-ec2` from
   `iam/ec2InstancePolicy.json`, with `<ENVIRONMENT>` = `production` and
   `<COGNITO_USER_POOL_ID>` = the **production** pool ID from step 1.7.
   Without that pool ID, account deletion and user invites fail with
   AccessDenied.
2. EC2 instance (`t3.medium`, tag `Project=field-portal`, bootstrap user
   data), Elastic IP, and security groups.
3. DNS A records `app.<domain>` and `api.<domain>` pointing at the Elastic IP.
4. SES out of sandbox mode, with `SES_FROM_EMAIL` verified.

## 3. Production secrets (Parameter Store)

1. `/field-portal/production/api-env` (SecureString), in the format of
   `backend/.env.example`, with at least:
   - `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`: the **production**
     values from step 1.7. The API rejects tokens from any other pool.
   - `PORTAL_ORIGIN=https://app.<domain>`
   - `DATABASE_URL` / `SERVICE_DATABASE_URL` pointing at `quiptech_prod`
     with `sslmode=verify-full`
   - fresh production `JWT_SECRET` / `JWT_REFRESH_SECRET` (not staging's)
   - live Stripe keys, if billing is on in production
2. `/field-portal/production/migrations-env`:
   `MIGRATION_DATABASE_URL=...quiptech_prod?sslmode=verify-full`.
3. Rotate the `field_app` / `field_service` placeholder passwords on the
   production database (`backend/README.md`).

## 4. GitHub repository variables

Go to **Settings → Secrets and variables → Actions → Variables**:

| Variable                                      | Value                       |
| --------------------------------------------- | --------------------------- |
| `PRODUCTION_EC2_INSTANCE_ID`                  | the production instance ID  |
| `PRODUCTION_PORTAL_DOMAIN`                    | `app.<domain>`              |
| `PRODUCTION_API_DOMAIN`                       | `api.<domain>`              |
| `PRODUCTION_NEXT_PUBLIC_COGNITO_USER_POOL_ID` | production pool ID          |
| `PRODUCTION_NEXT_PUBLIC_COGNITO_CLIENT_ID`    | production app client ID    |
| `PRODUCTION_NEXT_PUBLIC_COGNITO_DOMAIN`       | production Cognito domain   |

Cognito variables have **no shared fallback**. If staging still uses the
old unprefixed `NEXT_PUBLIC_COGNITO_*` variables, rename them to
`STAGING_NEXT_PUBLIC_COGNITO_*` (same values) and delete the unprefixed
ones. A deploy with a missing variable fails with the variable's name, and
a production deploy fails if its pool ID equals staging's.

Recommended: add a branch protection rule on `main` that requires a pull
request, so production only changes through a reviewed merge.

## 5. First production deploy

1. Merge `dev` → `staging-dev`, and check staging (sign in with email,
   Google and Apple).
2. Open a pull request `staging-dev` → `main` and merge it.
3. **Actions → Deploy Portal** shows the run. `resolveConfig` prints
   *Deploying main to production*. Then verify → buildImages → deploy →
   smoke test.
4. Check `https://app.<domain>`:
   - Register with email, then confirm the code email arrives (from SES).
   - Sign in with Google and with Apple. Each one should come back to
     `/auth/callback`, then show the signup profile dialog for a new user.
   - Sign out. Google/Apple should return to `/login`.
   - In the production pool's *Users* list, the new users appear, and they
     do **not** appear in the staging pool.

## Troubleshooting

- **`redirect_mismatch`** on the hosted UI: the callback or sign-out URL
  is missing from the production app client (step 1.6).
- **Google `redirect_uri_mismatch`** or **Apple `invalid_client`**: the
  production Cognito domain's `/oauth2/idpresponse` URL isn't registered
  with Google or Apple (steps 1.4 and 1.5).
- **401 from `/auth/sync`**: the portal image and the API env use
  different pools. Compare the GitHub `PRODUCTION_NEXT_PUBLIC_COGNITO_*`
  variables with `COGNITO_*` in `/field-portal/production/api-env`.
- **"Unsupported sign-in provider"**: an identity provider was renamed. It
  must be `Google` or `SignInWithApple`.
- **No verification email**: Cognito is still on its default sender, or
  SES is in sandbox mode.
