import { ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { readFeatureKeys } from '../entitlements/entitlements.service';
import {
  FEATURE_KEYS,
  FEATURE_MESSAGES,
  FEATURE_REQUIRED_CODE,
} from '../entitlements/featureKeys';

export const ACCOUNT_SUSPENDED_CODE = 'account_suspended';
const ACCOUNT_SUSPENDED_MESSAGE =
  "New AI sessions are paused until your organisation's overdue invoices are paid. Your existing threads still work.";

// A new AI thread needs the assistant in the organisation's plan and an
// account that isn't suspended for non-payment (billing spec sections 5
// and 9). Runs in the request's tenant transaction.
export const assertNewSessionAllowed = async (
  client: Pick<PoolClient, 'query'>,
): Promise<void> => {
  if (!(await readFeatureKeys(client)).has(FEATURE_KEYS.aiAssistant))
    throw new ForbiddenException({
      statusCode: 403,
      code: FEATURE_REQUIRED_CODE,
      feature: FEATURE_KEYS.aiAssistant,
      message: FEATURE_MESSAGES['ai.assistant'],
    });
  const suspended = await client.query<{ suspended: boolean }>(
    'SELECT current_billing_suspended() AS suspended',
  );
  if (suspended.rows[0]?.suspended)
    throw new ForbiddenException({
      statusCode: 403,
      code: ACCOUNT_SUSPENDED_CODE,
      message: ACCOUNT_SUSPENDED_MESSAGE,
    });
};
