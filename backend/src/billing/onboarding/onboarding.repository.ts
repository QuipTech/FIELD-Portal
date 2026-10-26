import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface OnboardingJobRow {
  id: string;
  billing_account_id: string;
  account_name: string;
  site_name: string;
  status: 'scheduled' | 'completed' | 'waived';
  invoice_id: string | null;
  waived_reason: string | null;
  completed_at: Date | null;
  created_at: Date;
}

const SELECT = `SELECT j.id, j.billing_account_id, a.name AS account_name, j.site_name,
    j.status, j.invoice_id, j.waived_reason, j.completed_at, j.created_at
  FROM billing.onboarding_jobs j
  JOIN billing.billing_accounts a ON a.id = j.billing_account_id`;

export const listOnboardingJobs = async (
  database: Reader,
  billingAccountId: string | null,
): Promise<OnboardingJobRow[]> => {
  const result = await database.query<OnboardingJobRow>(
    `${SELECT} WHERE j.deleted_at IS NULL AND ($1::uuid IS NULL OR j.billing_account_id = $1)
     ORDER BY (j.status = 'scheduled') DESC, j.created_at DESC LIMIT 200`,
    [billingAccountId],
  );
  return result.rows;
};

export const insertOnboardingJob = async (
  client: PoolClient,
  params: { billingAccountId: string; siteName: string; createdBy: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.onboarding_jobs (billing_account_id, site_name, created_by)
     VALUES ($1, $2, $3) RETURNING id`,
    [params.billingAccountId, params.siteName, params.createdBy],
  );
  return result.rows[0].id;
};

// Locks a scheduled job for completing or waiving; undefined when it is
// missing or no longer scheduled.
export const lockScheduledJob = async (
  client: PoolClient,
  jobId: string,
): Promise<{ billing_account_id: string; site_name: string } | undefined> => {
  const result = await client.query(
    `SELECT billing_account_id, site_name FROM billing.onboarding_jobs
     WHERE id = $1 AND status = 'scheduled' AND deleted_at IS NULL FOR UPDATE`,
    [jobId],
  );
  return result.rows[0];
};

export const closeOnboardingJob = async (
  client: PoolClient,
  params: {
    jobId: string;
    status: 'completed' | 'waived';
    invoiceId: string | null;
    waivedReason: string | null;
    closedBy: string;
  },
): Promise<void> => {
  await client.query(
    `UPDATE billing.onboarding_jobs
     SET status = $2::varchar, invoice_id = $3, waived_reason = $4, closed_by = $5,
         completed_at = CASE WHEN $2::varchar = 'completed' THEN now() ELSE completed_at END,
         updated_at = now()
     WHERE id = $1`,
    [
      params.jobId,
      params.status,
      params.invoiceId,
      params.waivedReason,
      params.closedBy,
    ],
  );
};
