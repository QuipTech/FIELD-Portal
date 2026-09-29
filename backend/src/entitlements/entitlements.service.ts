import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Entitlement, EntitlementRow, toEntitlement } from './entitlementRules';

// The only place features are checked: app.entitlements, read through the
// tenant role (RLS limits it to the tenant's own rows). Never Stripe —
// the billing module keeps this table in sync.
@Injectable()
export class EntitlementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listEntitlements = async (tenantId: string): Promise<Entitlement[]> => {
    const rows = await this.databaseService.withTenant(
      tenantId,
      async (client) => {
        const result = await client.query<EntitlementRow>(
          `SELECT feature_code, is_enabled, limit_value, valid_until
         FROM app.entitlements WHERE tenant_id = $1 ORDER BY feature_code`,
          [tenantId],
        );
        return result.rows;
      },
    );
    return rows.map((row) => toEntitlement(row));
  };

  hasFeature = async (
    tenantId: string,
    featureCode: string,
  ): Promise<boolean> => {
    const entitlements = await this.listEntitlements(tenantId);
    return entitlements.some(
      (entitlement) =>
        entitlement.featureCode === featureCode && entitlement.isActive,
    );
  };
}
