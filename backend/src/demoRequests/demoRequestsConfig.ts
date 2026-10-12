import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getPortalOrigins } from '../common/security/portalOrigins';

// DEMO_REQUEST_NOTIFY_TO: comma-separated sales inboxes for new requests (DEMO_NOTIFY_EMAIL, its earlier name, still
// works). Links in the team email use the first PORTAL_ORIGIN.
@Injectable()
export class DemoRequestsConfig {
  readonly notifyEmails: string[];
  readonly portalOrigin: string;

  constructor(configService: ConfigService) {
    this.notifyEmails = (
      configService.get<string>('DEMO_REQUEST_NOTIFY_TO') ??
      configService.get<string>('DEMO_NOTIFY_EMAIL') ??
      ''
    )
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
    this.portalOrigin = getPortalOrigins()[0].trim().replace(/\/$/, '');
  }

  requestUrl = (requestId: string) =>
    `${this.portalOrigin}/admin/demo-requests?id=${requestId}`;
}
