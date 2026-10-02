# sms

## Purpose

Sends text messages with Amazon SNS. Used by the alert engine (`src/alertEngine`) for P1 alerts only. With `NOTIFICATIONS_ENABLED` not set to `true` it logs what it would send instead.

## Folder structure

```
sms/
├── sms.module.ts         ← exports SmsService
├── sms.service.ts        ← SNS Publish with SMS type + sender id, dry-run logging
├── smsConfig.ts          ← region, sender id, SMS type, on/off switch (env)
└── isE164PhoneNumber.ts  ← the phone format every number is stored and sent in
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Unit tests: `npx jest src/sms` (SNS is mocked).

## Key conventions

- Numbers must be E.164 (`+61412345678`); anything else is refused before calling AWS. Profiles store numbers in this format.
- The API's AWS credentials need `sns:Publish`.
- New AWS accounts start in the SNS **SMS sandbox**: texts only reach phone numbers verified in SNS → Text messaging (SMS). Request production access before real use. Some countries (including Australia) have their own rules for alphanumeric sender IDs; check the SNS console before relying on `SNS_SMS_SENDER_ID`.

## Environment variables required

- `AWS_REGION`
- `SNS_SMS_SENDER_ID` (optional), `SNS_SMS_TYPE` (`Transactional` by default)
- `NOTIFICATIONS_ENABLED` — `true` to send; otherwise log only
