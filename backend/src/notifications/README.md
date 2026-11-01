# notifications

## Purpose

The signed-in user's in-app notifications: the portal's bell (live badge and dropdown) and the `/notifications` screen. This module reads rows, marks them read, and pushes new ones live over Socket.IO. Rows are written by database triggers (migration `0054_user_notifications.sql`) and by the alert engine (`src/alertEngine`, kind `alert`).

## Folder structure

```
notifications/
├── notifications.controller.ts  ← GET /notifications, GET /unread-count, POST /:id/read, POST /read-all
├── notifications.service.ts     ← paging (`before` cursor), read state
├── notifications.repository.ts  ← raw SQL, always filtered to the caller
├── notifications.gateway.ts     ← Socket.IO /notifications: token-checked, one room per user
├── notificationListener.service.ts ← LISTEN user_notification → emit to the user's room
├── notificationEvents.ts        ← room name, event name, Postgres channel
├── notifications.module.ts
├── dto/, types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Needs migrations `0053`, `0054` and `0065` (the `pg_notify` trigger behind the live bell).

## Key conventions

- **Adding an event:** write a trigger that calls `notify_users(recipients, exclude, kind, title, body, link)`, and add the new kind to the table's CHECK constraint and to `NotificationKind`.
- **Who did it:** the person who made a change is never notified about it. For writes made on a user's behalf, use `DatabaseService.withActor(actor, …)` instead of `withTenant` so the triggers know who that is.
- **Live updates:** a trigger on `notifications` (migration 0065) calls `pg_notify`; each API instance LISTENs on one dedicated connection and emits `notification:new` to that user's room only. The portal then refetches over REST, so the socket never carries notification content.

## Environment variables required

`DATABASE_URL` (the listener's connection), `JWT_SECRET` (socket auth).

## Push devices and preferences

`GET/POST /me/devices` and `DELETE /me/devices/:id` register the app's raw APNs or FCM token. Call POST on every app start and sign-in with `{ deviceType, pushToken, appVersion, bundleId, apnsEnvironment }`; the response's `id` is what DELETE takes on sign-out. `GET/PUT /me/notification-preferences` saves push and email on/off plus muted kinds; before anything is saved, everything is on. The in-app feed ignores them.

### Push (Amazon SNS → APNs / FCM), `push/`

- **Register** (`pushDevices.service.ts`): the row is upserted by token (unique; a shared phone's token moves to whoever signed in last, migration `0112`), then the SNS endpoint is created on the platform application for the build's `bundleId|apnsEnvironment` (`bundleId|fcm` for Android; missing values mean the production app). An endpoint that "already exists with different attributes" is reused, and every registration sets `Enabled: true`, `Token` and `CustomUserData` (the user id) again. SNS trouble never fails the request: the device is saved and the next launch retries.
- **Sign-out**: `DeleteEndpoint`, then the row (204; 404 if already gone). Deleting or removing an account deletes all of that person's endpoints first.
- **Send** (`pushSender.service.ts`): the notification listener hands every new notification to the sender in the background. `claim_notification_push()` gives it to one API container only, with the unread count for the badge, and skips it when the person turned push off or muted that kind. Each enabled device gets `{ aps: { alert, sound, badge }, notificationId, kind, link }` under `APNS` or `APNS_SANDBOX` (matching the endpoint), or the FCM v1 message under `GCM`. `EndpointDisabled` marks the device disabled, `NotFound` deletes it, and the others still get theirs. Each attempt is logged in `notification_deliveries` (channel `push`).

### Push environment variables

- `PUSH_PLATFORM_APPLICATIONS`: JSON mapping `"<bundleId>|<sandbox|production|fcm>"` to the SNS platform application ARN, e.g. `{"au.com.quiptechfield.field|production":"arn:aws:sns:ap-southeast-2:…:app/APNS/field-ios-prod","au.com.quiptechfield.field.staging|production":"…/APNS/field-ios-staging","au.com.quiptechfield.field.dev|sandbox":"…/APNS_SANDBOX/field-ios-dev"}`. A build without an entry registers but gets no endpoint.
- `PUSH_SNS_REGION` (else `AWS_REGION`, else ap-southeast-2), `PUSH_DEFAULT_BUNDLE_ID` (default `au.com.quiptechfield.field`).
- `NOTIFICATIONS_ENABLED=true` publishes; otherwise pushes are only logged (endpoints are still created).
- The API's role needs `sns:CreatePlatformEndpoint`, `sns:SetEndpointAttributes`, `sns:DeleteEndpoint` and `sns:Publish`. The APNs `.p8` key lives in Secrets Manager and is only used to create the platform applications, never by the API.
