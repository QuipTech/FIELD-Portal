import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasePriority } from './types/dashboardResponse';

const DEFAULT_SLA_HOURS: Record<CasePriority, number> = {
  P1: 4,
  P2: 24,
  P3: 72,
};

const readHours = (
  configService: ConfigService,
  priority: CasePriority,
): number => {
  const value = Number(
    configService.get<string>(`SUPPORT_SLA_HOURS_${priority}`),
  );
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SLA_HOURS[priority];
};

// Support case response targets, from case creation. A case still open
// or in progress past its target counts as breaching SLA.
@Injectable()
export class DashboardConfig {
  readonly slaHours: Record<CasePriority, number>;

  constructor(configService: ConfigService) {
    this.slaHours = {
      P1: readHours(configService, 'P1'),
      P2: readHours(configService, 'P2'),
      P3: readHours(configService, 'P3'),
    };
  }
}
