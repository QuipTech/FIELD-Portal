import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_REGION = 'ap-southeast-2';
// The production app; also what an app that sends no bundle ID is.
const DEFAULT_BUNDLE_ID = 'au.com.quiptechfield.field';

// Push settings. PUSH_PLATFORM_APPLICATIONS maps an app build to its SNS
// platform application, as JSON:
//   { "au.com.quiptechfield.field|production": "arn:aws:sns:…:app/APNS/field-ios-prod",
//     "au.com.quiptechfield.field.staging|production": "arn:…/APNS/field-ios-staging",
//     "au.com.quiptechfield.field.dev|sandbox": "arn:…/APNS_SANDBOX/field-ios-dev",
//     "au.com.quiptechfield.field|fcm": "arn:…/GCM/field-android" }
// A build with no entry still registers; it just gets no SNS endpoint.
// NOTIFICATIONS_ENABLED=true publishes; anything else logs what would be
// sent (endpoints are still created, so devices are ready).
@Injectable()
export class PushConfig {
  private readonly logger = new Logger(PushConfig.name);
  readonly region: string;
  readonly defaultBundleId: string;
  readonly isSendingEnabled: boolean;
  private readonly platformApplications: Record<string, string>;

  constructor(configService: ConfigService) {
    this.region =
      configService.get<string>('PUSH_SNS_REGION') ||
      configService.get<string>('AWS_REGION') ||
      DEFAULT_REGION;
    this.defaultBundleId =
      configService.get<string>('PUSH_DEFAULT_BUNDLE_ID') || DEFAULT_BUNDLE_ID;
    this.isSendingEnabled =
      configService.get<string>('NOTIFICATIONS_ENABLED') === 'true';
    this.platformApplications = this.readApplications(
      configService.get<string>('PUSH_PLATFORM_APPLICATIONS'),
    );
  }

  // The SNS platform application ARN for "<bundleId>|<sandbox|production|fcm>".
  platformApplicationArn = (key: string): string | null =>
    this.platformApplications[key] ?? null;

  private readApplications = (raw: string | undefined) => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        );
    } catch {
      // Logged below.
    }
    this.logger.error(
      'PUSH_PLATFORM_APPLICATIONS is not a JSON object of ARNs; push is off.',
    );
    return {};
  };
}
