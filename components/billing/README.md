# Personal billing UI

personalPaymentPrompt.tsx mounts in the root layout. It checks the authenticated
user's /me/billing status after login/signup, skips public authentication routes,
and allows the billing page to remain accessible for invoice inspection.

personalPaymentDialog.tsx shows the full calendar-month amount ex GST, collects
an Australian billing address, and opens Stripe Checkout after explicit
confirmation. No card information is collected by FIELD. Checkout sends the user
back to /settings/billing, where paymentReturnBanner.tsx confirms the payment with
Stripe and offers "Continue to FIELD". Payment is checked again on focus,
reconnect, page restore and polling. A payment counts only once the API has
confirmed it with Stripe, never because a link was opened.

The existing role/permission and entitlement enforcement remains in the API.
The prompt itself is a UI requirement, not a replacement for endpoint guards.

Run from the repository root: `npm test -- --maxWorkers=2 --minWorkers=1`.
See docs/billing/BILLING_API.md for the implemented API and remaining work.
