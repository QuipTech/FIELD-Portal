# FIELD Subscription & Billing Spec v1.0

**Some values are deliberately config, not code:** the AI and storage
allowances, the remote session block price, and partner margins. Section
11 lists every value with its default. Nothing in this spec should be
hard-coded as a literal in application logic.

**Decisions marked \"Spec decision\"** were made in writing this spec to
fill a gap the commercial terms didn\'t cover. Confirm them with Mark
before building.

## 1. Locked principles

1.  **QuipTech owns the source of truth.** Plans, subscriptions,
    entitlements, usage and invoice lines live in QuipTech tables.
    Stripe is a synchroniser and payment processor; the app never reads
    entitlements from Stripe. The entitlement layer is
    provider-agnostic.

2.  **The billing account owns the subscription, not the tenant.** One
    billing account can pay for several tenants or sites; a partner can
    own a billing account on a customer\'s behalf.

3.  **Metering is unconditional from the first deployment.** Every AI
    turn, remote session, storage change and document ingestion is
    recorded, whether or not it is billed today.

4.  **Exhausting an entitlement never hard-blocks a technician
    mid-session.** Limits raise flags and notifications; they don\'t
    stop work.

5.  **Tenant isolation is enforced with RLS** on every billing and usage
    table, the same as the rest of the schema.

6.  **Sync-ready conventions apply:** timestamptz everywhere, soft
    deletes, a row version, since cursors and idempotency keys on every
    write that can be retried.

7.  **The partner/reseller hierarchy is in the data model from day
    one,** not retrofitted.

8.  **Money is AUD, ex-GST, stored as integer cents.** GST (10%) is
    added at invoice time via Stripe Tax.

## 2. Plans and price list

All prices are AUD ex-GST. Codes are the stable identifiers to use in
the plan and price tables; display names can change. Everything
recurring is billed **monthly in arrears on one invoice**.

  --------------------------------------------------------------------------------
  Code               Name           Price         Unit        Billing
  ------------------ -------------- ------------- ----------- --------------------
  ASSET_PRO          FIELD Asset    By fleet      Active      Monthly in arrears,
                     Professional   size, below.  machine per or annual prepaid
                                    No minimum    month       

  TECH               FIELD          A\$49.00      User per    Monthly in arrears,
                     Technician                   month       or annual prepaid

  REMOTE_SESSION     Remote         A\$35.00      Per 15      Monthly in arrears
                     technical                    minutes or  
                     session                      part        

  ENTERPRISE         FIELD          Quoted;       Annual      500+ machines, or
                     Enterprise     **minimum     contract    custom terms
                                    A\$5,000 per              
                                    year**                    

  ONBOARD_ASSISTED   Assisted       A\$2,500.00   Per site,   Invoiced on
                     onboarding                   one-off     completion

  HARDWARE           Hardware       Quoted        Per item    Manual invoice line;
                                                              outside subscription
                                                              logic
  --------------------------------------------------------------------------------

There is no pilot or trial product. New customers start on a normal
monthly plan with no lock-in.

Fleet self-import (Excel/CSV) is free and is a feature, not a product.

### ASSET_PRO price by fleet size

The **whole fleet** is charged at the rate for its size.

  -----------------------------------------------------------------------
  Active machines in the month Price per machine per month (every
                               machine)
  ---------------------------- ------------------------------------------
  1 to 25                      A\$35.00

  26 to 99                     A\$29.00

  100 to 499                   A\$25.00

  500+                         Enterprise quote
  -----------------------------------------------------------------------

**Crossing a threshold moves every machine to the lower rate.** This is
deliberate: it rewards customers for activating more machines. So 25
machines cost A\$875.00 (25 × A\$35) and 26 machines cost A\$754.00 (26
× A\$29); 99 machines cost A\$2,871.00 and 100 cost A\$2,500.00. There
is no floor or smoothing.

Rates are data in a versioned price book, pinned to the subscription at
sign-up and renewal, so a later price change never re-prices an existing
contract silently.

**Spec decision:** a self-serve account that reaches 500 machines keeps
billing at A\$25 and raises a sales task. Activations are never refused
for crossing the threshold.

## 3. Billing rules

### Rules

1.  **Billing period** is the calendar month. Day boundaries use the
    billing account\'s time zone (default Australia/Brisbane). *Spec
    decision.*

2.  **Billable machines = the month\'s peak:** the highest number of
    machines active on any one day of the month. There are no part-month
    charges.

3.  A machine activated on any day of the month counts toward that day.
    Deactivating, archiving or selling a machine doesn\'t reduce a peak
    already reached; it lowers next month\'s count.

4.  **ASSET_PRO charge** = peak × the rate for the peak\'s band. Every
    machine is charged the same rate.

5.  **TECH charge** = the month\'s peak number of seats × A\$49.

6.  **Remote sessions** are charged per 15-minute block or part block,
    from each session\'s duration (section 7).

7.  All amounts are whole cents; no rounding is needed except annual
    over-commit (round half-up to the cent).

### Pseudocode

rate(n): n \<= 25 -\> 3500\
n \<= 99 -\> 2900\
else -\> 2500 \# n \>= 500 also raises a sales task\
price(n) = n \* rate(n)\
\
peak(account, period) = max over days d in period of\
count machines where activated_on \<= d and (billing_end is null or d \<
billing_end)\
\
asset_charge = price(peak(account, period))

billing_end is the first day of the month after the deactivation,
archive or sale date. Band limits and rates come from the pinned price
book, never literals.

### Annual prepaid

-   At sign-up or renewal the customer commits to a machine count **Q**
    and pays **price(Q) × 10** up front for 12 months (two months free).

-   In any month where the peak is above Q, add ASSET_PRO_OVER_COMMIT =
    (price(peak) − price(Q)) × 10/12.

-   Below Q there is no refund. At renewal Q resets to the current count
    unless the customer chooses another.

-   TECH annual: seats × A\$49 × 10 up front; extra seats in a month are
    charged at A\$49 × 10/12.

## 4. Machine lifecycle

Every machine has a permanent internal Asset ID and one of four
lifecycle states. Only **Active** machines are billed. Plant numbers and
VIN/PIN/serials are searchable identifiers, never keys.

**Machine lifecycle (4 states, 5 transitions).** A machine is billed only while active; charges stop from the next month.

- Registered (inactive): free, stays in the register, identity and summary only
- Active: counts in the month's peak from the activation day
- Archived: charge stops next month, records kept
- Sold / transferred: charge stops next month, machine facts move, private notes stay
- Transitions: Registered -> Active (activate), Active -> Registered (deactivate), Active -> Archived (archive), Archived -> Active (reactivate), Active -> Sold/transferred (sell or transfer)

  --------------------------------------------------------------------------
  Transition    Who can do it     Billing effect Also
  ------------- ----------------- -------------- ---------------------------
  Activate      Organisation      Counted from   Opens an asset_activation
                administrator;    the activation interval
                partner if        day            
                granted                          

  Deactivate    Organisation      Counted to the Sets billing_end = first
                administrator     end of the     day of next period
                                  current month  

  Archive       Organisation      As deactivate  Records kept under the
                administrator                    retention policy

  Reactivate    Organisation      Counted from   Restores access to retained
                administrator     the            records; opens a new
                                  reactivation   interval
                                  day            

  Sell /        Organisation      As deactivate  Machine facts move with the
  transfer      administrator,                   machine; the previous
                with approval                    owner\'s work orders,
                from the                         pricing, people and
                receiving                        commercial notes stay
                organisation                     behind. Chain of custody is
                                                 recorded
  --------------------------------------------------------------------------

Every transition writes an audit entry: actor, time, from-state,
to-state and reason. Two machines are never merged automatically; an
identifier correction is an audited edit.

## 5. Entitlements and users

Entitlements are resolved from QuipTech tables at request time (cached,
invalidated on change). Every check is a named feature key, never a
plan-name comparison in code.

  -------------------------------------------------------------------------
  Feature key                       TECH          ASSET_PRO    ENTERPRISE
  --------------------------------- ------------- ------------ ------------
  ai.assistant                      Yes           Yes          Yes

  knowledge.read                    Yes (shared   Yes          Yes
                                    multi-brand                
                                    library)                   

  fleet.register (load and keep     No            Yes          Yes
  machine records)                                             

  fleet.import (Excel/CSV)          No            Yes          Yes

  asset.history (full history on    No            Yes          Yes
  active machines)                                             

  remote.session                    Yes (metered) Yes          Yes
                                                  (metered)    

  org.users.unlimited               No: one named Yes          Yes
                                    user                       

  sso.saml                          No            No           Yes

  whitelabel                        No            No           Yes

  oem.licence_controls              No            No           Yes
  -------------------------------------------------------------------------

**Inactive machines** stay in the fleet register and show identity and
summary only; full history, AI context and remote sessions need the
machine to be active.

### Users

-   Every user has a named account. Shared logins are not supported;
    workshop devices need named sign-in or session attribution.

-   ASSET_PRO and ENTERPRISE have **no seat charge**. Roles:
    organisation administrator, supervisor, technician, read-only
    viewer, authorised external service provider.

-   External service providers (for example Red Edge) get scoped access
    granted by the owning organisation, which can revoke it at any time.

-   A TECH user who joins an organisation keeps their own plan for their
    own work; inside the organisation they act under its entitlements.

## 6. Metering and AI fair use

### What is metered

Every event below writes a usage_event row, append-only, with an
idempotency key. Metering runs for every plan, including internal and
demo tenants.

  -------------------------------------------------------------------------
  Event type       Recorded fields (beyond the common    Billed today?
                   ones)                                 
  ---------------- ------------------------------------- ------------------
  ai.turn          model id, inference profile, input    No: fair use
                   tokens, output tokens, estimated cost 
                   (USD micro-cents), session id, asset  
                   id if attached, citations count       

  ai.session       start, end, turn count (turns per     No
                   session is the key sizing metric)     

  remote.session   start, end, duration, billable        Yes:
                   15-minute blocks, provider session    REMOTE_SESSION
                   id, participants                      

  storage.delta    bytes added or removed, object type   No: fair use

  doc.ingest       pages, bytes, document id             No: fair use
  -------------------------------------------------------------------------

Common fields on every row: billing_account_id, tenant_id, user_id,
occurred_at, idempotency_key, row_version.

### AI allowance

-   Monthly allowance per billing account =
    AI_ALLOWANCE_PER_ACTIVE_MACHINE × average active machines +
    AI_ALLOWANCE_PER_TECH_USER × TECH seats. **Pooled** across all users
    and tenants on the account.

-   The unit is AI turns. Values are config, set from the first customer
    sites\' usage (section 11).

### Thresholds and actions

  -----------------------------------------------------------------------
  Usage of monthly allowance        Action
  --------------------------------- -------------------------------------
  Under 80%                         None

  80%                               Notify organisation administrators
                                    (in-app and email)

  100%                              Notify administrators and QuipTech;
                                    flag the account. **Do not block,
                                    throttle or degrade any session.**

  Over 100% for two consecutive     Create a plan-review task for
  months                            QuipTech (or the partner). No
                                    automatic charge.
  -----------------------------------------------------------------------

The same thresholds apply to storage and document ingestion against
their own allowances.

**Spec decision:** an optional abuse guard (AI_ABUSE_CEILING_MULTIPLIER,
default off) may later stop *new* sessions above a high multiple of the
allowance. It must never interrupt a session already in progress.

## 7. Onboarding, sessions and partners

### Onboarding (ONBOARD_ASSISTED)

-   Fleet self-import is free.

-   Assisted onboarding is A\$2,500 per site, one invoice line when the
    job is marked complete. It is never recurring and never folded into
    a renewal.

-   An administrator can waive it with a reason; the waiver is
    audit-logged.

### Remote technical sessions (REMOTE_SESSION)

-   **A\$35 per 15 minutes or part.** Blocks = ceil(duration in seconds
    / 900): a 14-minute call is 1 block, 15:01 is 2 blocks. Billed
    monthly in arrears.

-   Sessions under 2 minutes aren\'t charged (*spec decision*: covers
    dropped connections).

-   Duration runs from the expert joining to the session ending. The
    block price and length are config (A\$35.00, 15 minutes).

### Partner billing

Hierarchy: **partner → billing account → tenant(s) → sites**. A billing
account has at most one partner at a time, set by a versioned
partner_agreement.

  ------------------------------------------------------------------------
  Setting          Options                                Default
  ---------------- -------------------------------------- ----------------
  Billing mode     partner_bills: QuipTech invoices the   Set per
                   partner net of margin; the partner     agreement
                   invoices the customer. quiptech_bills: 
                   QuipTech invoices the customer at list 
                   and pays the partner a monthly         
                   commission.                            

  Margin           Percentage per agreement, versioned    25%

  Margin applies   ASSET_PRO, ONBOARD_ASSISTED,           As listed
  to               REMOTE_SESSION                         

  No margin on     TECH (sold direct), HARDWARE           As listed
  ------------------------------------------------------------------------

Partners see usage and invoices for their billing accounts. They see a
tenant\'s technical data only if that organisation has granted them
access.

## 8. Data model

Every table below also carries the standard columns: id uuid, tenant_id
or billing_account_id for RLS, created_at, updated_at, deleted_at (soft
delete), row_version. Money is bigint cents. Timestamps are timestamptz;
billing days are date in the account\'s time zone.

  -----------------------------------------------------------------------------
  Table                  Key columns                         Notes
  ---------------------- ----------------------------------- ------------------
  partner                name, abn, status                   Resellers and
                                                             dealers, e.g. Red
                                                             Edge

  partner_agreement      partner_id, billing_account_id,     Versioned; one
                         billing_mode, margin_bps,           active per billing
                         effective_from, effective_to        account

  billing_account        name, abn, timezone, currency       Owns
                         (AUD), stripe_customer_id,          subscriptions;
                         partner_id                          tenants point to
                                                             it

  tenant (existing)      \+ billing_account_id               One billing
                                                             account, many
                                                             tenants

  plan                   code, name, unit, billing_basis     Static reference:
                                                             the codes in
                                                             section 2

  price_book             plan_code, version, effective_from, Versioned price
                         unit_cents, minimum_annual_cents    list
                         (Enterprise)                        

  price_band             price_book_id, band_no, lower_qty,  Whole-fleet rates
                         upper_qty, unit_cents               by fleet size

  subscription           billing_account_id, plan_code,      price_book_id is
                         price_book_id, term                 pinned at sign-up
                         (monthly/annual), committed_qty,    and renewal
                         status, started_at,                 
                         current_period_start/end, cancel_at 

  seat                   subscription_id, user_id,           TECH seats
                         started_on, billing_end             

  asset (existing)       \+ lifecycle_state                  See section 4
                         (registered/active/archived/sold)   

  asset_activation       asset_id, billing_account_id,       Interval per
                         activated_on,                       activation; at
                         deactivation_requested_at,          most one open
                         billing_end, actor_user_id, reason  interval per asset

  daily_billable_count   billing_account_id, day,            Nightly snapshot;
                         active_machines, tech_seats         the month\'s peak
                                                             is the max of
                                                             these rows

  usage_event            billing_account_id, tenant_id,      Append-only; never
                         user_id, event_type, quantity,      updated
                         unit, attributes jsonb,             
                         occurred_at, idempotency_key        
                         (unique)                            

  allowance_period       billing_account_id, period_start,   One row per metric
                         metric, allowance, used,            per month
                         threshold_state, consecutive_over   

  invoice                billing_account_id, period_start,   Immutable once
                         period_end, status                  final; fix with a
                         (draft/final/synced/paid/void),     credit note
                         stripe_invoice_id,                  
                         total_ex_gst_cents                  

  invoice_line           invoice_id, line_type, quantity,    calc_snapshot
                         unit_cents, amount_cents,           stores the peak,
                         partner_margin_cents, calc_snapshot the day it
                         jsonb                               occurred and the
                                                             price book used

  partner_statement      partner_id, period, gross_cents,    Monthly, per
                         margin_cents, net_cents             partner

  review_task            billing_account_id, type, reason,   Plan reviews,
                         status                              Enterprise
                                                             threshold, abuse
                                                             flags
  -----------------------------------------------------------------------------

**Line types:** ASSET_PRO, ASSET_PRO_ANNUAL, ASSET_PRO_OVER_COMMIT,
TECH, TECH_ANNUAL, REMOTE_SESSION, ONBOARD_ASSISTED, HARDWARE,
CREDIT_NOTE.

## 9. Stripe mapping and invoice flow

QuipTech calculates every amount; Stripe presents the invoice, adds GST
and collects payment. **Don\'t use Stripe subscriptions or Stripe tiered
prices to calculate charges.** Push QuipTech-calculated lines as Stripe
invoice items.

  -----------------------------------------------------------------------
  QuipTech                Stripe
  ----------------------- -----------------------------------------------
  billing_account         Customer (ABN stored as an AU ABN tax ID)

  plan codes              Products, for reporting only

  invoice                 Invoice, with metadata.quiptech_invoice_id

  invoice_line            Invoice item, idempotency key = invoice_line.id

  GST                     Stripe Tax, Australia, 10%

  partner_bills mode      The Stripe Customer is the partner; lines are
                          net of margin
  -----------------------------------------------------------------------

### Monthly run (1st of each month, account time zone)

1.  **Snapshot.** The nightly job has written daily_billable_count for
    every day of the closing month.

2.  **Calculate** in QuipTech, all in arrears: ASSET_PRO on the month\'s
    peak count, ASSET_PRO_OVER_COMMIT (annual accounts), TECH on the
    month\'s peak seats and REMOTE_SESSION blocks. Write the invoice as
    draft with a calc_snapshot on every line.

3.  **Finalise** in QuipTech after a 24-hour review window (*spec
    decision*), then push to Stripe as invoice items and finalise the
    Stripe invoice. Status becomes synced.

4.  **Collect.** Payment terms are 14 days (draft Terms of Service).
    Card or direct debit is charged automatically; otherwise Stripe
    emails the invoice.

5.  **Webhooks** (invoice.finalized, invoice.paid,
    invoice.payment_failed, charge.refunded) update QuipTech invoice
    status only. They never change entitlements directly.

6.  **Partners.** Generate partner_statement rows; in quiptech_bills
    mode, the commission is paid outside Stripe.

Annual prepaid and assisted onboarding are invoiced at the moment they
occur, through the same calculate → draft → finalise → push path.

### Overdue accounts

Notify the billing contact when an invoice is 1 and 7 days overdue.
After 14 days\' written notice (Terms of Service), an administrator can
suspend the account. **Suspension blocks new sessions and new
activations only; it never ends a session in progress.** Reading and
exporting data stays available.

## 10. Acceptance tests

Each row is a unit or integration test. Amounts are AUD ex-GST unless
stated. April has 30 days.

### Price by fleet size, price(n)

  -------------------------------------------------------------------------
  Test   Input                        Expected
  ------ ---------------------------- -------------------------------------
  T1     2 machines                   A\$70.00 (no minimum)

  T2     15 machines                  A\$525.00

  T3     25, then 26 machines         A\$875.00, then A\$754.00 (all 26 at
                                      A\$29)

  T4     50 machines                  A\$1,450.00

  T5     99, then 100 machines        A\$2,871.00, then A\$2,500.00 (all
                                      100 at A\$25)

  T6     200 machines                 A\$5,000.00

  T7     499 machines                 A\$12,475.00

  T8     500 machines, self-serve     A\$12,500.00 and one sales
                                      review_task; activation not refused

  T8a    Enterprise contract quoted   Rejected at contract set-up: minimum
         below A\$5,000 a year        A\$5,000 a year
  -------------------------------------------------------------------------

### Monthly calculation

  ------------------------------------------------------------------------
  Test   Scenario                         Expected
  ------ -------------------------------- --------------------------------
  T9     15 machines all April; 5 more    Peak 20 → **A\$700.00**
         activated 21 April               

  T10    20 machines; 5 deactivated 10    April peak 20 → A\$700.00; May
         April                            peak 15 → A\$525.00

  T11    10 machines steady; machine A    A counts all April, so peak = 12
         deactivated 5 April (billing_end → A\$420.00
         1 May); machine B activated 20   
         April                            

  T12    25 machines; 1 more activated 16 Peak 26 → A\$754.00 (all at
         April                            A\$29)

  T13    Annual, Q = 15                   A\$5,250.00 up front; a month
                                          with peak 20 adds
                                          ASSET_PRO_OVER_COMMIT (700 −
                                          525) × 10/12 = **A\$145.83**

  T14    TECH: 2 seats, a third added 16  Peak 3 → A\$147.00
         April                            
  ------------------------------------------------------------------------

### Remote sessions

  -----------------------------------------------------------------------
  Test       Session length            Expected
  ---------- ------------------------- ----------------------------------
  T15        1 min 30 s                Metered, not charged

  T16        14 min                    1 block, A\$35.00

  T17        15 min 00 s               1 block, A\$35.00

  T18        15 min 01 s               2 blocks, A\$70.00

  T19        47 min                    4 blocks, A\$140.00
  -----------------------------------------------------------------------

### Sign-up, partners, tax

  -------------------------------------------------------------------------
  Test   Scenario                     Expected
  ------ ---------------------------- -------------------------------------
  T20    partner_bills, 50 machines,  List A\$1,450.00; margin A\$362.50;
         25% margin                   partner invoiced A\$1,087.50

  T21    A\$525.00 invoice to an AU   GST A\$52.50; total A\$577.50
         customer                     

  T22    New customer signs up        Starts on monthly ASSET_PRO
                                      immediately; no trial or pilot record
                                      created
  -------------------------------------------------------------------------

### Behaviour

  -------------------------------------------------------------------------
  Test   Scenario                        Expected
  ------ ------------------------------- ----------------------------------
  T25    AI allowance passes 100% during Session continues normally;
         a live session                  account flagged; administrators
                                         notified; no charge line

  T26    Over 100% for a second          One review_task created; still no
         consecutive month               charge and no block

  T27    Price book changes mid-term     Existing subscriptions stay on
                                         their pinned price_book_id until
                                         renewal

  T28    Same usage_event posted twice   One row stored
         with one idempotency key        

  T29    Stripe webhook invoice.paid     Invoice status paid; entitlements
                                         unchanged

  T30    Account suspended for           Session continues; new sessions
         non-payment during a live       and activations refused
         session                         

  T31    Recalculate a finalised invoice Same amounts to the cent
         from calc_snapshot              
  -------------------------------------------------------------------------

## 11. Configuration and open items

All of these live in configuration or the price book, editable without a
deploy.

  -----------------------------------------------------------------------------
  Key                                    Default              Status
  -------------------------------------- -------------------- -----------------
  ASSET_PRO bands                        1--25 / 26--99 /     Final
                                         100--499 machines    

  ASSET_PRO band rates                   3500 / 2900 / 2500   Final
                                         cents                

  ENTERPRISE_THRESHOLD_MACHINES          500                  Final

  ENTERPRISE_MIN_ANNUAL_CENTS            500000               Final

  TECH_PRICE_CENTS                       4900                 Final

  ANNUAL_MONTHS_CHARGED                  10                   Final

  REMOTE_BLOCK_CENTS /                   3500 / 15 / 120      Final; minimum is
  REMOTE_BLOCK_MINUTES /                                      a spec decision
  REMOTE_MIN_SECONDS                                          

  ONBOARD_ASSISTED_CENTS                 250000               Final

  AI_ALLOWANCE_PER_ACTIVE_MACHINE (turns TBD                  Open: set from
  per month)                                                  the first
                                                              customer sites\'
                                                              usage

  AI_ALLOWANCE_PER_TECH_USER (turns per  TBD                  Open: set from
  month)                                                      the first
                                                              customer sites\'
                                                              usage

  AI_NOTIFY_THRESHOLD /                  0.8 / 1.0            Final
  AI_FLAG_THRESHOLD                                           

  AI_ABUSE_CEILING_MULTIPLIER            null (off)           Spec decision

  STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE / TBD                  Open
  INGEST_ALLOWANCE                                            

  PARTNER_DEFAULT_MARGIN_BPS             2500                 Pending Red Edge
                                                              agreement

  PAYMENT_TERMS_DAYS /                   14 / 24              Final / spec
  INVOICE_REVIEW_HOURS                                        decision

  DEFAULT_BILLING_TIMEZONE               Australia/Brisbane   Spec decision

  CANCEL_EXPORT_DAYS /                   30 / 90              Final (matches
  CANCEL_DELETE_DAYS                                          Terms)
  -----------------------------------------------------------------------------
