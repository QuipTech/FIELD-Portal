import { ForbiddenException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Entitlement } from './entitlementRules';
import {
  FEATURE_MESSAGES,
  FEATURE_REQUIRED_CODE,
  FeatureKey,
} from './featureKeys';

// Entitlements change only when a plan changes; a short cache keeps the
// check off every request without serving a change for long (spec
// section 5: resolved at request time, cached, invalidated on change).
const CACHE_MS = 30_000;

// What the request's organisation may use, as the spec's feature keys:
// from its billing account's live plans (current_feature_keys(), migration
// 0110). Never Stripe, never a plan-name comparison.
@Injectable()
export class EntitlementsService {
  private readonly cache = new Map<
    string,
    { keys: Set<string>; until: number }
  >();

  constructor(private readonly databaseService: DatabaseService) {}

  listFeatureKeys = async (tenantId: string): Promise<Set<string>> => {
    const cached = this.cache.get(tenantId);
    if (cached && cached.until > Date.now()) return cached.keys;
    const keys = await this.databaseService.withTenant(tenantId, (client) =>
      readFeatureKeys(client),
    );
    this.cache.set(tenantId, { keys, until: Date.now() + CACHE_MS });
    return keys;
  };

  hasFeature = async (
    tenantId: string,
    key: FeatureKey | string,
  ): Promise<boolean> => (await this.listFeatureKeys(tenantId)).has(key);

  // 403 feature_not_in_plan when the organisation's plan lacks the key.
  requireFeature = async (tenantId: string, key: FeatureKey): Promise<void> => {
    if (await this.hasFeature(tenantId, key)) return;
    throw new ForbiddenException({
      statusCode: 403,
      code: FEATURE_REQUIRED_CODE,
      feature: key,
      message: FEATURE_MESSAGES[key],
    });
  };

  // After a plan change in this process; other containers catch up within
  // CACHE_MS.
  invalidate = (tenantId?: string) => {
    if (tenantId) this.cache.delete(tenantId);
    else this.cache.clear();
  };

  // The apps' view: one row per feature key the organisation has.
  listEntitlements = async (tenantId: string): Promise<Entitlement[]> =>
    [...(await this.listFeatureKeys(tenantId))].sort().map((featureCode) => ({
      featureCode,
      isActive: true,
      limit: null,
      validUntil: null,
    }));
}

// Inside a request's tenant transaction.
export const readFeatureKeys = async (
  client: Pick<PoolClient, 'query'>,
): Promise<Set<string>> => {
  const result = await client.query<{ feature_code: string }>(
    'SELECT DISTINCT feature_code FROM current_feature_keys()',
  );
  return new Set(result.rows.map((row) => row.feature_code));
};
