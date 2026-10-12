# email

## Purpose

Sends email with Amazon SES for the whole API: alert notifications (`src/alertEngine`), scheduled reports (`src/adminReports`) and demo requests (`src/demoRequests`). One `EmailService.sendEmail` takes a recipient, subject, plain text and optionally HTML, one attachment and a Reply-To address, and sends it as a raw MIME message. With `NOTIFICATIONS_ENABLED` not set to `true` it logs what it would send instead.

## Folder structure

```
email/
├── email.module.ts          ← exports EmailService
├── email.service.ts         ← SES v2 SendEmail (Raw), dry-run logging
├── emailConfig.ts           ← sender, region, on/off switch (env)
├── buildRawEmail.ts         ← MIME: text + optional HTML + optional attachment
└── types/outgoingEmail.ts
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Unit tests: `npx jest src/email` (SES is mocked).

## Key conventions

- One email per recipient, so recipients never see each other's addresses.
- Subjects and display names are RFC 2047 encoded-words, so user-typed text can't add headers.
- The API's AWS credentials need `ses:SendEmail` and `ses:SendRawEmail` on `identity/*` and `configuration-set/*` (SES checks the identity's default configuration set too).
- While the SES account is in sandbox mode, every recipient must be a verified identity.

## Environment variables required

- `SES_FROM_EMAIL`, `SES_FROM_NAME`
- `SES_REGION` (optional, defaults to `AWS_REGION`), `AWS_REGION`
- `NOTIFICATIONS_ENABLED` — `true` to send; otherwise log only
