import { Injectable } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { listBillingConfigRows } from './billingConfig.repository';
import { BillingConfig, BillingConfigEntry } from './billingConfigKeys';
import { isBillingConfigKey, toBillingConfig } from './billingConfigValueRules';

// Read fresh on every call: config is edited without a deploy and the API
// runs in several containers, so a per-process cache could serve a stale
// threshold. Jobs load it once per run.
@Injectable()
export class BillingConfigService {
  constructor(private readonly serviceDatabase: ServiceDatabaseService) {}

  loadConfig = async (): Promise<BillingConfig> =>
    toBillingConfig(await listBillingConfigRows(this.serviceDatabase));

  // For the super admin config editor: every key with its "not final" flag.
  listEntries = async (): Promise<BillingConfigEntry[]> => {
    const rows = await listBillingConfigRows(this.serviceDatabase);
    return rows
      .filter((row) => isBillingConfigKey(row.key))
      .map((row) => ({
        key: row.key as BillingConfigEntry['key'],
        value: row.value as BillingConfigEntry['value'],
        isFinal: row.is_final,
        description: row.description,
        updatedAt: row.updated_at.toISOString(),
      }));
  };
}
