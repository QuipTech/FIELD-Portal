import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The scheduled report worker's switch. Email itself is set up in
// src/email (SES_FROM_EMAIL).
@Injectable()
export class ReportsConfig {
  readonly isWorkerEnabled: boolean;

  constructor(configService: ConfigService) {
    this.isWorkerEnabled =
      configService.get<string>('SCHEDULED_REPORTS_WORKER_ENABLED') !== 'false';
  }
}
