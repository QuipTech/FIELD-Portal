# QuipTech FIELD — Portal

## Purpose

This is the User Portal and Admin Console frontend for QuipTech FIELD — a separate Next.js app from the marketing landing page at the project root. It's currently a bare scaffold; the actual portal/admin screens are not built yet and should be implemented next from the `QuipTech FIELD Phase 1 UI` designs.

## Folder structure

```
portal/
├── app/
│   ├── layout.tsx     ← root layout, fonts, metadata
│   ├── page.tsx        ← placeholder home page
│   └── globals.css     ← Tailwind entry point
├── tailwind.config.ts   ← shares FIELD's brand color tokens
├── tsconfig.json
└── next.config.js
```

## How to run locally

```bash
cd portal
npm install
npm run dev
```

Runs on **http://localhost:3001** (not 3000), so it can run side by side with the landing app.

## Deployment

Staging (`staging-dev` branch → `https://staging.<domain>`) and production
(`main` → `https://app.<domain>`) run on Amazon EC2 and are deployed by
`.github/workflows/deployPortal.yml`. Setup and operations are covered in
[`deploy/README.md`](deploy/README.md). The production build uses
`output: "standalone"` (`next.config.js`) so the Docker image can run
without the full `node_modules`.

## Key conventions specific to this app

- Independent app with its own `package.json` — not part of a monorepo/workspace with the landing page.
- Follows the same naming, component, and 200-line file rules as the rest of the project (see the root `CLAUDE.md`).
- Brand color tokens in `tailwind.config.ts` are duplicated from the landing app's config to keep visual consistency; if this grows into a real monorepo later, promote them to a shared `packages/types` or `packages/ui` token file instead of keeping two copies in sync by hand.
- **Permission-gated actions:** a feature the user's role doesn't allow stays visible but can't be used. Wrap its button in `PermissionButton` (`components/auth/`), which disables it with a lock icon and a hover explanation; wrap whole areas in `PermissionView`, which shows a notice instead. Codes live in `lib/auth/permissionCodes.ts` and must match the backend's `permissions` table. `usePermissions()` re-reads them from `/auth/me` on each page, so role changes apply without signing out. This is UI only — each backend endpoint must still check the permission itself.
- **File uploads:** use the shared uploaders in `components/uploads/` (`DocumentUploader`, `MachinePhotoUploader`, `AvatarUploader`) — each posts to its backend endpoint with progress via `lib/api/multipartUpload.ts` + `lib/uploads/useFileUpload.ts`. Files are private in S3: never build S3 links; show the `signedUrl`/`downloadUrl` the API returns (valid 15 minutes — reload the record for a fresh one). Upload responses share the `UploadedFile` type (`lib/types/uploadedFile.ts`).

## Authentication

Two sign-in paths, both ending in the same FIELD session (access + refresh
token from the backend, stored by `lib/auth/authSession.ts`):

- **Email / password** — `app/login/page.tsx` → `POST /auth/login` on our
  own backend. Not handled by Cognito.
- **Google / Apple** — AWS Cognito hosted UI via Amplify:
  1. `app/login/components/oauthButtons.tsx` calls
     `signInWithFederatedProvider()` (`lib/auth/cognitoFederatedSignIn.ts`),
     which runs Amplify `signInWithRedirect`.
  2. Cognito sends the browser back to `/auth/callback`
     (`app/auth/callback/`), where Amplify exchanges the code for tokens.
  3. The Cognito **ID token** is sent to `POST /auth/sync`; the backend
     verifies it, links it to the matching `users` row, and returns a normal
     FIELD session, which is saved exactly like an email/password login.
  4. The same buttons are on `/login` and `/register` and behave the same:
     an existing account (matched by Cognito ID, then email) goes straight
     to the dashboard. A first-time user gets `profileRequired` instead, and
     the callback page shows a required dialog
     (`app/auth/callback/components/signupProfileDialog.tsx`) for company
     name + phone number; submitting it calls `/auth/sync` again, which
     creates their organisation (they're its Owner) and signs them in.
- **Logout** (`lib/auth/useLogout.ts`) also calls Amplify `signOut`, which
  for Google/Apple users goes through Cognito's logout endpoint back to
  `/login`; for email/password users it's a no-op.

Amplify is configured in `lib/auth/amplifyConfig.ts`. Redirect URLs are
built from the current origin, so the Cognito app client must list, per
environment: callback `<origin>/auth/callback` and sign-out URL
`<origin>/login` (dev: `http://localhost:3001/...`). The app client must
have **no client secret** and allow the `openid` and `email` scopes.

## Environment variables required

Copy `.env.example` to `.env.local` (gitignored):

- `NEXT_PUBLIC_API_BASE_URL` — backend base URL
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN` — hosted UI domain (with or without `https://`)
