import { PoolClient } from 'pg';

// Writes from Stripe webhooks into billing.* and app.*. Runs on the
// service-role pool (ServiceDatabaseService): the tenant role can't write
// app.* or see billing.* at all.

// True when this event should be processed: first delivery, or a retry of
// one that failed before. A redelivery of a processed event returns false.
export const claimWebhookEvent = async (
  client: PoolClient,
  event: { id: string; type: string; payload: unknown },
): Promise<boolean> => {
  const result = await client.query(
    `INSERT INTO billing.stripe_webhook_log (stripe_event_id, event_type, status, payload)
     VALUES ($1, $2, 'processed', $3)
     ON CONFLICT (stripe_event_id) DO UPDATE
       SET status = 'processed', error = NULL, received_at = now()
       WHERE billing.stripe_webhook_log.status = 'failed'
     RETURNING stripe_event_id`,
    [event.id, event.type, event.payload],
  );
  return (result.rowCount ?? 0) > 0;
};

export const markWebhookEvent = async (
  client: PoolClient,
  params: {
    id: string;
    type: string;
    payload: unknown;
    status: 'ignored' | 'failed';
    error: string;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO billing.stripe_webhook_log (stripe_event_id, event_type, status, error, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_event_id) DO UPDATE SET status = $3, error = $4`,
    [params.id, params.type, params.status, params.error, params.payload],
  );
};

export const linkStripeCustomer = async (
  client: PoolClient,
  params: { tenantId: string; stripeCustomerId: string },
): Promise<void> => {
  await client.query(
    `INSERT INTO billing.stripe_customers (tenant_id, stripe_customer_id)
     SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tenants WHERE id = $1)
     ON CONFLICT (tenant_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
    [params.tenantId, params.stripeCustomerId],
  );
};

export const findTenantForCustomer = async (
  client: PoolClient,
  stripeCustomerId: string,
): Promise<string | undefined> => {
  const result = await client.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM billing.stripe_customers WHERE stripe_customer_id = $1`,
    [stripeCustomerId],
  );
  return result.rows[0]?.tenant_id;
};

export const findPlanForPrice = async (
  client: PoolClient,
  stripePriceId: string,
): Promise<string | undefined> => {
  const result = await client.query<{ code: string }>(
    `SELECT code FROM platform.plans WHERE stripe_price_id = $1`,
    [stripePriceId],
  );
  return result.rows[0]?.code;
};

// Stripe-managed subscription: tier/term/status come from Stripe; the
// admin-set add-ons, allowance and notes are left as they are. Then the
// tenant's entitlements are rebuilt.
export const syncStripeSubscription = async (
  client: PoolClient,
  params: {
    tenantId: string;
    planCode: string;
    startsOn: string;
    endsOn: string | null;
    stripeStatus: string;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO app.subscriptions (tenant_id, tier, billing_basis, starts_on, ends_on, source, stripe_status)
     VALUES ($1, $2::varchar, CASE WHEN $2::varchar = 'demo' THEN NULL ELSE 'per_asset' END, $3, $4, 'stripe', $5)
     ON CONFLICT (tenant_id) DO UPDATE SET
       tier = EXCLUDED.tier,
       billing_basis = COALESCE(app.subscriptions.billing_basis, EXCLUDED.billing_basis),
       starts_on = EXCLUDED.starts_on,
       ends_on = EXCLUDED.ends_on,
       source = 'stripe',
       stripe_status = EXCLUDED.stripe_status`,
    [
      params.tenantId,
      params.planCode,
      params.startsOn,
      params.endsOn,
      params.stripeStatus,
    ],
  );
  await client.query('SELECT app.sync_entitlements($1)', [params.tenantId]);
};

export const upsertStripeInvoice = async (
  client: PoolClient,
  invoice: {
    id: string;
    tenantId: string | undefined;
    customerId: string;
    status: string | null;
    currency: string;
    amountDue: number;
    amountPaid: number;
    hostedUrl: string | null;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<void> => {
  await client.query(
    `INSERT INTO billing.stripe_invoices (stripe_invoice_id, tenant_id, stripe_customer_id, status,
       currency, amount_due_cents, amount_paid_cents, hosted_invoice_url, period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET
       tenant_id = COALESCE(EXCLUDED.tenant_id, billing.stripe_invoices.tenant_id),
       status = EXCLUDED.status,
       amount_due_cents = EXCLUDED.amount_due_cents,
       amount_paid_cents = EXCLUDED.amount_paid_cents,
       hosted_invoice_url = EXCLUDED.hosted_invoice_url,
       updated_at = now()`,
    [
      invoice.id,
      invoice.tenantId ?? null,
      invoice.customerId,
      invoice.status,
      invoice.currency,
      invoice.amountDue,
      invoice.amountPaid,
      invoice.hostedUrl,
      invoice.periodStart,
      invoice.periodEnd,
    ],
  );
};
