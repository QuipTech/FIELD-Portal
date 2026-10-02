# alertEngine

## Purpose

Evaluates each organisation's switched-on alert rules (Settings → Notifications & alerts, `src/organisationNotifications`) and sends the alerts. For every match it works out who to tell inside the rule's organisation, writes one in-app notification per person (which the live bell picks up), and delivers it by email (SES), SMS (SNS, P1 only) and push (stub for now). Every outcome is stored in `notification_deliveries`.

## Folder structure

```
alertEngine/
├── alertEngine.module.ts         ← exports AlertEngineService
├── alertEngine.service.ts        ← scheduled checks, the AI-flagged event, Send test
├── alertSchedule.service.ts      ← @nestjs/schedule cron jobs
├── alertDispatcher.service.ts    ← recipients → cooldown → channels → delivery records
├── resolveRecipients.ts          ← audiences → people (same organisation only)
├── filterChannels.ts             ← rule ∩ organisation switches; SMS only for P1
├── alertEmailTemplate.ts         ← branded HTML + plain text
├── alertRules.repository.ts      ← rules and trigger queries (migration 0065)
├── alertDelivery.repository.ts   ← recipients, notification + delivery records
├── triggers/                     ← one finder per trigger type
├── channels/                     ← NotificationChannel: email, sms, push (stub)
└── types/
```

## How to run locally

Runs inside the API (`npm run start:dev` in `backend/`). Needs migrations `0064` and `0065`. Unit tests: `npx jest src/alertEngine` (SES, SNS and the database are mocked).

## Key conventions

- **When rules run:** P1/other case "unactioned" every minute; machine down and service overdue every 5 minutes; fleet uptime Mondays (weekly rules) and the 1st (monthly rules) at 8am Sydney time. "AI answer flagged" fires straight away from `src/aiAssistant`. Only switched-on rules are evaluated.
- **Organisation isolation:** every query takes the rule's organisation; `resolveRecipients` and `alert_record_notification` both drop anyone from another organisation as well.
- **Audiences** (no dedicated roles exist yet): Admins = Customer or Owner role; Site supervisor = Technical Manager; Assigned technician = the case's assignee, or anyone who logged history on the machine in the last 90 days; AI reviewer group = Knowledge Manager role or anyone who has reviewed answers in the organisation.
- **Service overdue** means "in Service due status for more than N hours" — no service interval is stored yet.
- **Cooldown:** a rule alerts the same person about the same machine/case/site at most once per `cooldown_minutes` (default 4 h, set per rule). Checked and written atomically in the database, so several API instances can't double-send.
- **Channels:** used only when on for both the rule and the organisation's Delivery channels. SMS only for "P1 case unactioned" rules. A person without an email/phone gets a `skipped` delivery, logged.
- **Push** is a stub (`skipped: Push provider not connected yet`); add an FCM provider behind `NotificationChannel` later.
- With `NOTIFICATIONS_ENABLED` not `true`, email and SMS are logged instead of sent; in-app notifications are still created.

## Environment variables required

- `ALERT_ENGINE_ENABLED` — `false` stops the scheduled checks
- Email and SMS settings: see `src/email` and `src/sms`
- `PORTAL_ORIGIN` — the first origin is used for links in emails and texts
