import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getPortalOrigins } from '../common/security/portalOrigins';

// TURNSTILE_SECRET_KEY: the Turnstile widget's secret (unset = every
// submission is refused). DEMO_NOTIFY_EMAIL: comma-separated team inboxes
// for new requests. Links in the team email use the first PORTAL_ORIGIN.
@Injectable()
export class DemoRequestsConfig {
  readonly turnstileSecretKey: string | undefined;
  readonly notifyEmails: string[];
  readonly portalOrigin: string;

  constructor(configService: ConfigService) {
    this.turnstileSecretKey =
      configService.get<string>('TURNSTILE_SECRET_KEY') || undefined;
    this.notifyEmails = (configService.get<string>('DEMO_NOTIFY_EMAIL') ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
    this.portalOrigin = getPortalOrigins()[0].trim().replace(/\/$/, '');
  }

  requestUrl = (requestId: string) =>
    `${this.portalOrigin}/admin/demo-requests?id=${requestId}`;
}
