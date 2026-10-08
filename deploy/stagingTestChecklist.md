# Staging test checklist

Run this on **https://staging.quiptechfield.com.au** before anything is
promoted to production. Every 🔴 **critical** row must pass. 🟡 rows may be
signed off as known issues.

**Tester:** ____________ **Date:** ____________ **Commit (Actions run):** ____________

Mark each row: ✅ pass · ❌ fail (write what happened) · ⏭ skipped (say why)

---

## 0. Before you start

| #   | Check                                                                                         | Result |
| --- | --------------------------------------------------------------------------------------------- | ------ |
| 0.1 | Latest `dev` merged into `staging-dev`; **GitHub → Actions → Deploy Portal** run is green (verify → buildImages → deploy → smoke test) | |
| 0.2 | https://staging.quiptechfield.com.au loads with a valid padlock (HTTPS)                         | |
| 0.3 | https://staging-api.quiptechfield.com.au responds (no browser error page)                      | |
| 0.4 | Browser console (F12) shows no red errors on `/login`                                          | |

**Email limits on staging:** SES is in sandbox mode. **Alert, report, invite
and demo emails** only reach verified addresses (`@quiptechfield.com.au` or
`uneebmalik99@gmail.com`). **Sign-up and reset codes** come from Cognito and
reach any address, up to about 50 a day.

**Test accounts:** use one browser profile or incognito window per role.

| Role               | Email used | Notes                                       |
| ------------------ | ---------- | ------------------------------------------- |
| Owner (platform)   |            | Sees `/admin/*`                             |
| Customer (org admin) |          | Created by self-registration                |
| Technical Manager  |            | Invited                                     |
| Field Technician   |            | Invited                                     |
| Knowledge Manager  |            | Invited                                     |

---

## 1. Sign-up and sign-in 🔴

| #    | Test                                                                                          | Expected                                                           | Result |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| 1.1  | `/register` with a new email, company and phone                                                | 6-digit code email arrives                                         | |
| 1.2  | Enter the code on `/verify-email`                                                               | Signed in and on the dashboard; a new organisation is created      | |
| 1.3  | Wrong or expired code                                                                           | Clear error, no crash                                              | |
| 1.4  | Register again with the same email                                                              | "Account already exists" style message                             | |
| 1.5  | Sign out, then sign in with email and password                                                  | Dashboard                                                          | |
| 1.6  | Wrong password                                                                                  | Error message, not signed in                                       | |
| 1.7  | **Google** sign-in with a new Google account                                                    | Back to `/auth/callback`, then the company/phone dialog, then the dashboard | |
| 1.8  | Google sign-in again with the same account                                                      | Straight to the dashboard (no dialog)                              | |
| 1.9  | **Apple** sign-in, choosing "Share My Email"                                                    | Same as 1.7                                                        | |
| 1.10 | Apple sign-in, choosing "Hide My Email"                                                         | Works, with a `privaterelay.appleid.com` email                     | |
| 1.11 | Google sign-in with an email that already has a password account                                | Linked to the same account and organisation, no duplicate          | |
| 1.12 | Sign out (Google/Apple user)                                                                    | Lands on `/login`; Back button doesn't show private pages          | |
| 1.13 | Leave the session idle for more than 1 hour, then click around                                  | Session refreshes silently, or you're sent to `/login` cleanly     | |
| 1.14 | Open a private URL (e.g. `/machines`) while signed out                                          | Redirected to `/login`                                             | |

## 2. Password management 🔴

| #   | Test                                                                                           | Expected                                         | Result |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| 2.1 | `/forgot-password` with a password account → code → new password                                | Can sign in with the new password                | |
| 2.2 | Forgot password for a **Google/Apple-only** email                                               | Told to use Google/Apple, no code sent           | |
| 2.3 | Forgot password for an unknown email                                                            | Sensible message, no crash                       | |
| 2.4 | Settings → **Change password**                                                                  | Old password stops working, new one works        | |
| 2.5 | New password breaking the policy (no symbol / under 8 characters)                               | Clear validation message                         | |

## 3. User invitations and roles 🔴

| #   | Test                                                                                           | Expected                                                     | Result |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| 3.1 | Owner → `/admin/users` → invite a user (verified email) with role *Field Technician*            | Invite email with a temporary password                       | |
| 3.2 | Invitee signs in and is sent to `/set-password`                                                 | Sets a password, then reaches the dashboard                  | |
| 3.3 | Owner changes that user's role to *Technical Manager*                                           | New permissions apply after the user signs in again          | |
| 3.4 | `/admin/users` search, role filter and paging                                                   | Correct results                                              | |
| 3.5 | Field Technician opens `/admin/users` directly                                                  | Blocked (403 / redirect), no data shown                      | |
| 3.6 | `/admin/roles`: create a role, edit its permissions, delete it                                  | Works; duplicate name rejected; built-in roles locked        | |

## 4. Multi-tenancy (data isolation) 🔴

Use two separate organisations (A and B), each created by self-registration.

| #   | Test                                                                                           | Expected                                         | Result |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| 4.1 | Org A creates a machine, a support case and a document                                          | Visible to org A                                 | |
| 4.2 | Org B signs in                                                                                  | **None** of org A's data is visible anywhere     | |
| 4.3 | Org B pastes org A's machine URL (`/machines/<id>`) or case URL                                 | Not found / forbidden, never org A's data        | |
| 4.4 | Org B's AI assistant asks about org A's machine                                                 | No org A information in the answer or sources    | |

## 5. Dashboard and profile

| #   | Test                                                                                           | Expected                                         | Result |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| 5.1 | `/dashboard` loads                                                                              | Figures match the org's machines and cases       | |
| 5.2 | Settings → edit profile (name, phone)                                                           | Saved and shown after a refresh                  | |
| 5.3 | Upload an avatar 🔴                                                                             | Shown in the header and settings                 | |
| 5.4 | Organisation branding: upload logo, change, delete                                              | Applied across the portal                        | |
| 5.5 | `/two-factor-setup` and Settings → Manage two-factor 🟡                                         | **UI only for now** (no backend). Note behaviour | |

## 6. Machines 🔴

| #   | Test                                                                                           | Expected                                              | Result |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| 6.1 | `/machines` → add a machine from the catalogue                                                  | Appears in the list                                   | |
| 6.2 | Change machine status                                                                           | Saved; shown in the list and on the dashboard         | |
| 6.3 | Machine detail page and **Configuration** tab                                                   | Systems and components tree loads                     | |
| 6.4 | **History** → add an entry                                                                      | Saved with the author and date                        | |
| 6.5 | Add photos to a history entry, then delete one                                                  | Upload works (S3); thumbnail shows; delete removes it | |
| 6.6 | Field Technician edits another user's history entry                                            | Blocked unless the role has `history.edit_others`     | |

## 7. Machine library (Owner) 🟡

| #   | Test                                                                                           | Expected                                         | Result |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| 7.1 | `/admin/machines`: create a model, add systems and components                                   | Tree saved                                       | |
| 7.2 | Import a tree                                                                                   | Imported correctly; bad file gives a clear error | |
| 7.3 | Edit and delete a component, system and model                                                   | Works; a model in use is protected or warned     | |

## 8. Knowledge base 🔴

| #   | Test                                                                                           | Expected                                                    | Result |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| 8.1 | Upload a PDF document (org user with `knowledge.submit`)                                        | Status goes from processing to pending approval             | |
| 8.2 | Knowledge Manager approves it                                                                   | Status *published*; appears in `/knowledge`                 | |
| 8.3 | Reject a document; retry a failed one; archive one                                              | Each status changes correctly                               | |
| 8.4 | Upload a new version                                                                            | Latest version shown; old version kept                      | |
| 8.5 | Download a document                                                                             | Correct file opens                                          | |
| 8.6 | `/knowledge` search for a phrase inside the PDF                                                 | Document found (indexing/embeddings work)                   | |
| 8.7 | Owner → `/admin/knowledge`: upload a platform document, download it, delete it                  | Works; visible to all orgs once published                   | |
| 8.8 | Scanned PDF (image only) 🟡                                                                     | Only searchable if OCR (Textract) is enabled                | |

## 9. AI assistant 🔴

| #   | Test                                                                                           | Expected                                                   | Result |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 9.1 | `/assistant`: ask a question covered by a published document                                    | Streaming answer with **sources** linking to the document  | |
| 9.2 | Ask with a photo attached                                                                       | Answer uses the photo                                      | |
| 9.3 | Follow-up question in the same thread                                                           | Uses the earlier context                                   | |
| 9.4 | Conversation list: reopen an old conversation                                                   | Full history shown                                         | |
| 9.5 | User whose role lacks `ai.use`                                                                  | Assistant not available                                    | |
| 9.6 | Owner → `/admin/ai-configuration`: platform usage figures                                       | Shows the queries just made                                | |
| 9.7 | Prompts: create a version, **Test**, view the diff, publish                                     | Published prompt changes the answers                       | |
| 9.8 | Review queue: open an item, assign a reviewer, update its status                                | Saved                                                      | |

## 10. Support cases and notifications 🔴

| #    | Test                                                                                          | Expected                                                   | Result |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 10.1 | `/cases` → create a case (priority P2) linked to a machine                                     | Case number assigned; shown in the list                    | |
| 10.2 | Open the case → send a message; the second user replies                                        | Messages appear **live** for the other user (no refresh)   | |
| 10.3 | Change case status / priority (`support.manage`)                                               | Saved; history updated                                     | |
| 10.4 | Bell icon: new notification on reply                                                           | Unread count goes up **live**                              | |
| 10.5 | Mark one as read; mark all as read                                                             | Count updates                                              | |
| 10.6 | Create a **P1** case                                                                           | P1 alert (in app; email/SMS only to verified recipients)   | |

## 11. Organisation alerts and reports 🟡

| #    | Test                                                                                          | Expected                                                   | Result |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 11.1 | `/admin/settings/notifications`: enable email/SMS channels, create a rule                      | Saved                                                      | |
| 11.2 | Rule → **Test**                                                                                | Test email/SMS arrives (to a verified address or number)   | |
| 11.3 | Edit, disable and delete a rule                                                                | Works                                                      | |
| 11.4 | `/admin/settings/reports`: create a schedule → **Send now**                                    | Report email arrives (verified address)                    | |
| 11.5 | Export a report (CSV)                                                                          | File downloads with the correct data                       | |

## 12. Owner / platform admin 🟡

| #    | Test                                                                                          | Expected                                                   | Result |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 12.1 | `/admin/dashboard` overview                                                                    | Figures across all orgs                                    | |
| 12.2 | `/admin/subscriptions`: view orgs, change an org's plan                                        | Saved; that org's entitlements change                      | |
| 12.3 | `/admin/audit-log`: filter and export                                                          | Recent actions (invites, role changes) listed; export works | |
| 12.4 | `/admin/settings/data-retention`: change the retention period                                  | Saved                                                      | |
| 12.5 | `/admin/demo-requests`: submit the demo form on https://quiptechfield.com.au, then open it here | Request listed; status update and resend email work        | |

## 13. Billing 🟡

| #    | Test                                                                                          | Expected                                                   | Result |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 13.1 | `/settings/billing`: subscription summary                                                      | Shows the current plan and limits                          | |
| 13.2 | `/settings/billing/upgrade` → Continue to Stripe                                               | **Expected to fail on staging** (no Stripe keys, returns 503). Note behaviour | |
| 13.3 | Hit a plan limit (e.g. AI queries)                                                             | Clear "limit reached / upgrade" message                    | |

## 14. Personal data and account deletion 🔴

| #    | Test                                                                                          | Expected                                                   | Result |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| 14.1 | Settings → **Export my data**                                                                  | Export becomes ready; download contains your data          | |
| 14.2 | Settings → **Delete account** (throwaway user)                                                 | Signed out; can't sign in; user removed from the Cognito **staging** pool | |
| 14.3 | Register again with the deleted email                                                          | Works as a brand-new user                                  | |

## 15. General quality

| #    | Test                                                                                          | Expected                                         | Result |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------ |
| 15.1 | Every page on a phone (Safari iOS / Chrome Android)                                            | Usable layout, no sideways scrolling             | |
| 15.2 | Chrome, Safari, Firefox, Edge (desktop)                                                        | Sign-in + main pages work                        | |
| 15.3 | Refresh on any deep link (e.g. `/machines/<id>/history`)                                       | Page loads (no 404)                              | |
| 15.4 | Browser console while clicking through                                                         | No red errors                                    | |
| 15.5 | Slow network (DevTools → Slow 4G)                                                              | Loading states shown, no broken screens          | |

---

## Sign-off

| Area                              | Pass / Fail | Notes |
| --------------------------------- | ----------- | ----- |
| 🔴 Critical sections (1, 2, 3, 4, 6, 8, 9, 10, 14) |  |       |
| 🟡 Other sections                  |             |       |
| Known issues accepted by client   |             |       |

**Ready for production:** ☐ Yes ☐ No **Signed:** ____________

When reporting a failure, include: the row number, the user/role, a
screenshot, and the time it happened (to find it in the logs).
