import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { BillingConfigService } from '../../billing/billingConfig/billingConfig.service';
import { countAiQueries } from './aiUsage.repository';
import { AllowanceUsage, toAllowanceUsage, toUtcMonth } from './aiUsagePeriod';

const AI_FEATURE_CODE = 'ai_assistant';

// GET /ai/usage
export interface AiUsage {
  periodStart: string;
  periodEnd: string;
  // The caller's own questions this month against a TECH seat's share
  // (billing.config AI_ALLOWANCE_PER_TECH_USER). Seats are pooled, so this
  // is guidance; the organisation's allowance is the real limit.
  personal: AllowanceUsage;
  // Everyone in the organisation, against the plan's AI entitlement.
  organisation: AllowanceUsage & { isEnabled: boolean };
  // Share of an allowance at which the app should warn (e.g. 0.8).
  warningThreshold: number | null;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  getUsage = async (actor: AuthenticatedUser): Promise<AiUsage> => {
    const period = toUtcMonth(new Date());
    const { personalUsed, organisationUsed } =
      await this.databaseService.withTenant(actor.tenantId, async (client) => ({
        personalUsed: await countAiQueries(client, {
          tenantId: actor.tenantId,
          since: period.start,
          userId: actor.userId,
        }),
        organisationUsed: await countAiQueries(client, {
          tenantId: actor.tenantId,
          since: period.start,
        }),
      }));
    const entitlement = (
      await this.entitlements.listEntitlements(actor.tenantId)
    ).find((row) => row.featureCode === AI_FEATURE_CODE);
    const isEnabled = entitlement?.isActive ?? false;
    const config = await this.loadSeatAllowance();
    return {
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      personal: toAllowanceUsage(personalUsed, config.seatAllowance),
      organisation: {
        ...toAllowanceUsage(
          organisationUsed,
          isEnabled ? (entitlement?.limit ?? null) : 0,
        ),
        isEnabled,
      },
      warningThreshold: config.warningThreshold,
    };
  };

  // Billing config refuses to load with any key missing; usage still
  // answers, just without the personal share.
  private loadSeatAllowance = async (): Promise<{
    seatAllowance: number | null;
    warningThreshold: number | null;
  }> => {
    try {
      const config = await this.billingConfig.loadConfig();
      return {
        seatAllowance: config.AI_ALLOWANCE_PER_TECH_USER,
        warningThreshold: config.AI_NOTIFY_THRESHOLD,
      };
    } catch (error) {
      this.logger.warn(`Billing config unavailable: ${String(error)}`);
      return { seatAllowance: null, warningThreshold: null };
    }
  };
}
