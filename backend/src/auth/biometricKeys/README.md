# biometricKeys

## Purpose

Fingerprint / Face ID sign-in for the FIELD mobile app. Each phone makes an Ed25519 key pair and keeps the private key in the iOS Keychain / Android Keystore behind biometrics; the server stores only the public key. To sign in, the phone signs a single-use, 60-second server challenge and gets the same session as `POST /auth/sync`. The web portal uses passkeys (WebAuthn, `../passkeys`) instead, and its Settings → Security page lists these phones so a lost one can be removed.

## Folder structure

```
biometricKeys/
├── biometricKeys.controller.ts          ← GET/POST /me/biometric-keys, DELETE /me/biometric-keys/:keyId
├── biometricSignIn.controller.ts        ← POST /auth/biometric/challenge, POST /auth/biometric/verify (signed out, rate limited)
├── biometricKeyRegistration.service.ts  ← list, register (max 10 a user, oldest dropped), remove; audited
├── biometricSignIn.service.ts           ← challenge → signature check → session
├── biometricKeys.repository.ts          ← SQL; pre-sign-in calls go through 0111's SECURITY DEFINER functions
├── verifyEd25519Signature.ts            ← signed message format + Node crypto Ed25519 check
├── biometricSignInThrottle.ts           ← 10 a minute per IP (registered in AppModule)
└── dto/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Needs migration `0111_biometric_device_keys.sql`. Tests: `npm run test:passkeys` (in-memory Postgres, every migration applied).

## Key conventions

- **Signed message:** the UTF-8 bytes of `field-biometric-v1:<challengeId>:<challenge>`, where `<challenge>` is the base64 string exactly as the server sent it. Changing it breaks every installed app.
- **Single use:** the challenge is deleted before the signature is checked, so a replay always fails.
- **Status codes the app relies on:** 404 = key gone (revoked, removed, or unused for 90 days) and the app turns biometric sign-in off; 401 = bad or reused signature; 403 = user disabled or organisation suspended; 429 = rate limited.
- **Lockout:** 5 bad signatures in a row revoke the key (`biometric_record_failure`, audited as `sign_in_failed`).
- Deleting a user removes their keys (`ON DELETE CASCADE`).

## Environment variables required

None beyond the API's own (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`).
